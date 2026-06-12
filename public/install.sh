#!/usr/bin/env bash
# ==============================================================================
# VPS Monitor Agent - one-line installer
#
# Usage (on the target VPS):
#   curl -fsSL <DASHBOARD_URL>/api/install | sudo bash
#
# This installer:
#   - Installs deps (curl, jq) if missing
#   - Drops the agent script into /opt/vps-monitor-agent-$USER_ID/
#   - Registers with the dashboard (auto-generates agentId + token)
#   - Installs and starts a systemd service that survives reboots
# ==============================================================================
set -euo pipefail

SERVER_URL="__SERVER_URL__"
USER_ID="__USER_ID__"
INTERVAL="__INTERVAL__"
INSTALL_DIR="/opt/vps-monitor-agent-$USER_ID"
CONFIG_FILE="$INSTALL_DIR/agent.conf"
AGENT_SCRIPT="$INSTALL_DIR/agent.sh"
UNINSTALL_SCRIPT="$INSTALL_DIR/uninstall.sh"
SERVICE_FILE="/etc/systemd/system/vps-monitor-agent-$USER_ID.service"

c_blue=$'\e[1;34m'; c_green=$'\e[1;32m'; c_yellow=$'\e[1;33m'; c_red=$'\e[1;31m'; c_reset=$'\e[0m'
log()  { printf '%s==>%s %s\n' "$c_blue"   "$c_reset" "$*"; }
ok()   { printf '%s✓%s   %s\n' "$c_green"  "$c_reset" "$*"; }
warn() { printf '%s!%s   %s\n' "$c_yellow" "$c_reset" "$*"; }
die()  { printf '%s✗%s   %s\n' "$c_red"    "$c_reset" "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Please run as root (or with sudo)."

# ---- Detect package manager and install deps -------------------------------
log "Installing dependencies (curl, jq)…"
if command -v apt-get >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y >/dev/null
  apt-get install -y curl jq ca-certificates >/dev/null
elif command -v dnf >/dev/null 2>&1; then
  dnf install -y curl jq ca-certificates >/dev/null
elif command -v yum >/dev/null 2>&1; then
  yum install -y curl jq ca-certificates >/dev/null
elif command -v apk >/dev/null 2>&1; then
  apk add --no-cache curl jq ca-certificates bash procps coreutils >/dev/null
elif command -v pacman >/dev/null 2>&1; then
  pacman -Sy --noconfirm curl jq ca-certificates >/dev/null
else
  warn "No supported package manager found. Assuming curl/jq already installed."
fi
ok "Dependencies ready."

# ---- Collect system info ----------------------------------------------------
log "Detecting system…"

HOSTNAME_VAL="$(hostname 2>/dev/null || echo unknown)"
ARCH="$(uname -m 2>/dev/null || echo unknown)"
KERNEL="$(uname -r 2>/dev/null || echo unknown)"

OS_ID="linux"; OS_VER=""
if [ -r /etc/os-release ]; then
  . /etc/os-release
  OS_ID="${ID:-linux}"
  OS_VER="${VERSION_ID:-}"
fi

CPU_MODEL="$(awk -F: '/model name/{gsub(/^ +/,"",$2); print $2; exit}' /proc/cpuinfo 2>/dev/null || true)"
[ -z "$CPU_MODEL" ] && CPU_MODEL="$(uname -p 2>/dev/null || echo unknown)"
CPU_CORES="$(nproc 2>/dev/null || echo 1)"

MEM_TOTAL_KB="$(awk '/MemTotal/{print $2}' /proc/meminfo 2>/dev/null || echo 0)"
MEM_TOTAL_BYTES=$(( MEM_TOTAL_KB * 1024 ))

DISK_TOTAL_BYTES="$(df -B1 --output=size / 2>/dev/null | tail -1 | tr -d ' ' || echo 0)"
[ -z "$DISK_TOTAL_BYTES" ] && DISK_TOTAL_BYTES=0

PRIVATE_IP="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
PUBLIC_IP="$(curl -fsS --max-time 4 https://api.ipify.org 2>/dev/null || true)"
[ -z "$PUBLIC_IP" ] && PUBLIC_IP="$(curl -fsS --max-time 4 https://ifconfig.me 2>/dev/null || true)"

# ---- Generate or reuse agent id --------------------------------------------
mkdir -p "$INSTALL_DIR"

if [ -f "$CONFIG_FILE" ]; then
  log "Existing config detected — re-registering with same agentId."
  # shellcheck disable=SC1090
  . "$CONFIG_FILE"
fi

if [ -z "${AGENT_ID:-}" ]; then
  AGENT_ID="vps_$(head -c 16 /dev/urandom | od -An -tx1 | tr -d ' \n')"
fi

# ---- Register with dashboard ------------------------------------------------
log "Registering with $SERVER_URL …"

REG_PAYLOAD=$(jq -n \
  --arg agentId "$AGENT_ID" \
  --arg userId "$USER_ID" \
  --arg hostname "$HOSTNAME_VAL" \
  --arg os "$OS_ID" \
  --arg osVersion "$OS_VER" \
  --arg kernel "$KERNEL" \
  --arg arch "$ARCH" \
  --arg cpuModel "$CPU_MODEL" \
  --argjson cpuCores "${CPU_CORES:-1}" \
  --argjson totalMemoryBytes "${MEM_TOTAL_BYTES:-0}" \
  --argjson totalDiskBytes "${DISK_TOTAL_BYTES:-0}" \
  --arg publicIp "${PUBLIC_IP:-}" \
  --arg privateIp "${PRIVATE_IP:-}" \
  '{agentId:$agentId, userId:$userId, hostname:$hostname, os:$os, osVersion:$osVersion, kernel:$kernel, arch:$arch, cpuModel:$cpuModel, cpuCores:$cpuCores, totalMemoryBytes:$totalMemoryBytes, totalDiskBytes:$totalDiskBytes, publicIp:$publicIp, privateIp:$privateIp}')

REG_RESPONSE="$(curl -fsS -X POST "$SERVER_URL/api/agents/register" \
  -H 'Content-Type: application/json' \
  -d "$REG_PAYLOAD" || true)"

if [ -z "$REG_RESPONSE" ]; then
  die "Failed to contact dashboard at $SERVER_URL. Check connectivity / firewall."
fi

NEW_AGENT_ID=$(echo "$REG_RESPONSE" | jq -r '.agentId // empty')
NEW_TOKEN=$(echo "$REG_RESPONSE" | jq -r '.token // empty')

if [ -z "$NEW_AGENT_ID" ] || [ -z "$NEW_TOKEN" ]; then
  die "Registration failed. Server response: $REG_RESPONSE"
fi

AGENT_ID="$NEW_AGENT_ID"
AGENT_TOKEN="$NEW_TOKEN"
ok "Registered as $AGENT_ID."

# ---- Write config -----------------------------------------------------------
umask 077
cat > "$CONFIG_FILE" <<EOF
SERVER_URL="$SERVER_URL"
AGENT_ID="$AGENT_ID"
AGENT_TOKEN="$AGENT_TOKEN"
INTERVAL="$INTERVAL"
LOGS_TAIL="500"
EOF
chmod 600 "$CONFIG_FILE"

# ---- Write agent script -----------------------------------------------------
cat > "$AGENT_SCRIPT" <<'AGENT_EOF'
#!/usr/bin/env bash
# vps-monitor-agent: collects metrics and POSTs to the dashboard.
set -u

export LC_ALL=C
export LANG=C

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${1:-$SCRIPT_DIR/agent.conf}"
# shellcheck disable=SC1090
. "$CONFIG_FILE"

# Default configuration values
LOGS_TAIL="${LOGS_TAIL:-500}"

PREV_RX=0; PREV_TX=0; PREV_TS=0
PREV_CPU_TOTAL=0; PREV_CPU_IDLE=0
PREV_DISK_READ=0; PREV_DISK_WRITE=0
declare -A PREV_CONT_RX
declare -A PREV_CONT_TX

read_cpu() {
  read -r _ user nice system idle iowait irq softirq steal _ < /proc/stat
  local idle_all=$((idle + iowait))
  local non_idle=$((user + nice + system + irq + softirq + steal))
  local total=$((idle_all + non_idle))
  echo "$total $idle_all"
}

read_net() {
  local rx=0 tx=0
  while IFS= read -r line; do
    case "$line" in
      *:*)
        local iface="${line%%:*}"
        iface="${iface// /}"
        case "$iface" in
          lo|docker*|veth*|br-*|virbr*|tun*|tap*|wg*|cni*|flannel*|cali*) continue ;;
        esac
        local rest="${line#*:}"
        # shellcheck disable=SC2086
        set -- $rest
        rx=$(( rx + ${1:-0} ))
        tx=$(( tx + ${9:-0} ))
        ;;
    esac
  done < /proc/net/dev
  echo "$rx $tx"
}

get_disk() {
  df -B1 --output=used,size / 2>/dev/null | tail -1
}

to_bytes() {
  awk -v raw="$1" 'BEGIN {
    gsub(/^[[:space:]]+|[[:space:]]+$/, "", raw)
    if (raw == "" || raw == "--") { print 0; exit }
    unit = raw
    gsub(/[0-9.[:space:]]/, "", unit)
    num = raw
    gsub(/[^0-9.]/, "", num)
    n = num + 0
    unit = tolower(unit)
    if (unit == "kb" || unit == "kib") n *= 1024
    else if (unit == "mb" || unit == "mib") n *= 1048576
    else if (unit == "gb" || unit == "gib") n *= 1073741824
    else if (unit == "tb" || unit == "tib") n *= 1099511627776
    printf "%.0f", n
  }'
}

read_disk_io() {
  local read_bytes=0 write_bytes=0
  while IFS= read -r line; do
    # shellcheck disable=SC2086
    set -- $line
    local name="${3:-}"
    case "$name" in
      ''|loop*|ram*|zram*|fd*|sr*) continue ;;
    esac
    [ -d "/sys/block/$name" ] || continue
    read_bytes=$(( read_bytes + (${6:-0} * 512) ))
    write_bytes=$(( write_bytes + (${10:-0} * 512) ))
  done < /proc/diskstats
  echo "$read_bytes $write_bytes"
}

read_docker_containers() {
  if ! command -v docker >/dev/null 2>&1; then
    CONTAINERS_DATA="[]"
    return
  fi

  local stats_data
  stats_data=$(timeout 5 docker stats --no-stream --format '{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}|{{.NetIO}}' 2>/dev/null || true)

  local ps_data
  ps_data=$(docker ps -a --format '{{.Names}}|{{.Image}}|{{.Ports}}|{{.Status}}' 2>/dev/null || true)

  local json_payload="[]"

  while IFS= read -r line; do
    [ -z "$line" ] && continue
    
    local name image ports status
    name=$(echo "$line" | cut -d'|' -f1)
    image=$(echo "$line" | cut -d'|' -f2)
    ports=$(echo "$line" | cut -d'|' -f3)
    status=$(echo "$line" | cut -d'|' -f4)

    [ -z "$name" ] && continue

    local health="None"
    if [[ "$status" == *"(healthy)"* ]]; then
      health="Healthy"
    elif [[ "$status" == *"(unhealthy)"* ]]; then
      health="Unhealthy"
    fi

    local cpu="0"
    local mem=0
    local rx_bps=0
    local tx_bps=0

    local stats_line
    stats_line=$(echo "$stats_data" | grep "^${name}|" || true)
    if [ -n "$stats_line" ]; then
      local stats_cpu stats_mem stats_net
      stats_cpu=$(echo "$stats_line" | cut -d'|' -f2 | tr -d '% ')
      stats_mem=$(echo "$stats_line" | cut -d'|' -f3)
      stats_net=$(echo "$stats_line" | cut -d'|' -f4)

      cpu="${stats_cpu:-0}"
      cpu=$(echo "$cpu" | tr -d ' %')
      [ -z "$cpu" ] && cpu="0"

      local mem_current="${stats_mem%% / *}"
      mem=$(to_bytes "$mem_current")

      local rx_raw="${stats_net%% / *}"
      local tx_raw="${stats_net##* / }"
      local rx_bytes=$(to_bytes "$rx_raw")
      local tx_bytes=$(to_bytes "$tx_raw")

      local prev_rx=0
      local prev_tx=0
      if [[ -v PREV_CONT_RX[$name] ]]; then
        prev_rx=${PREV_CONT_RX[$name]}
      fi
      if [[ -v PREV_CONT_TX[$name] ]]; then
        prev_tx=${PREV_CONT_TX[$name]}
      fi

      if [ "$prev_rx" -gt 0 ] && [ "$ELAPSED" -gt 0 ]; then
        local rx_delta=$(( rx_bytes - prev_rx ))
        [ "$rx_delta" -lt 0 ] && rx_delta=0
        rx_bps=$(( rx_delta / ELAPSED ))
      fi
      if [ "$prev_tx" -gt 0 ] && [ "$ELAPSED" -gt 0 ]; then
        local tx_delta=$(( tx_bytes - prev_tx ))
        [ "$tx_delta" -lt 0 ] && tx_delta=0
        tx_bps=$(( tx_delta / ELAPSED ))
      fi

      PREV_CONT_RX[$name]=$rx_bytes
      PREV_CONT_TX[$name]=$tx_bytes
    fi

    local logs_json="[]"
    logs_json=$(timeout 3 docker logs --tail "$LOGS_TAIL" "$name" 2>/dev/null | jq -R . | jq -s . || echo "[]")

    local inspect_json="{}"
    inspect_json=$(timeout 3 docker inspect --format '{{json .}}' "$name" 2>/dev/null | jq '{AppArmorProfile, Args, Config, State, NetworkSettings}' 2>/dev/null || echo "{}")

    # Use temp files for large JSON blobs (logs, details, accumulated payload)
    # to avoid "Argument list too long" (E2BIG) when passing via --argjson
    local _tmp_logs _tmp_details _tmp_payload
    _tmp_logs=$(mktemp); _tmp_details=$(mktemp); _tmp_payload=$(mktemp)
    printf '%s' "$logs_json"    > "$_tmp_logs"
    printf '%s' "$inspect_json" > "$_tmp_details"
    printf '%s' "$json_payload" > "$_tmp_payload"
    json_payload=$(jq --arg name "$name" \
                      --arg image "$image" \
                      --arg ports "$ports" \
                      --arg status "$status" \
                      --arg health "$health" \
                      --argjson cpu "$cpu" \
                      --argjson mem "$mem" \
                      --argjson rx "$rx_bps" \
                      --argjson tx "$tx_bps" \
                      --slurpfile logs    "$_tmp_logs" \
                      --slurpfile details "$_tmp_details" \
                      '. += [{name:$name, image:$image, ports:$ports, status:$status, health:$health, cpuPercent:$cpu, memUsedBytes:$mem, netRxBps:$rx, netTxBps:$tx, logs:$logs[0], details:$details[0]}]' "$_tmp_payload")
    rm -f "$_tmp_logs" "$_tmp_details" "$_tmp_payload"
  done <<< "$ps_data"

  CONTAINERS_DATA="$json_payload"
}

read_temperature_c() {
  for f in /sys/class/thermal/thermal_zone*/temp /sys/class/hwmon/hwmon*/temp*_input; do
    if [ -r "$f" ]; then
      read -r v < "$f" || v=0
      printf '%s\n' "$v"
    fi
  done | awk 'BEGIN { max = 0; found = 0 } {
    v = $1 + 0
    if (v > 1000) v = v / 1000
    if (v > max) max = v
    found = 1
  } END { if (found) printf "%.1f", max; else printf "0" }'
}

read_gpu() {
  if command -v nvidia-smi >/dev/null 2>&1; then
    local out
    out="$(timeout 5 nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total,power.draw --format=csv,noheader,nounits 2>/dev/null | awk -F, '
      { gsub(/ /, ""); util += $1; mem_used += $2 * 1048576; mem_total += $3 * 1048576; power += $4; count += 1 }
      END { if (count > 0) printf "%.2f %.0f %.0f %.2f", util / count, mem_used, mem_total, power }
    ')"
    if [ -n "$out" ]; then
      echo "$out"
      return
    fi
  fi

  local count=0 util_sum=0 mem_used=0 mem_total=0 power_micro=0
  for f in /sys/class/drm/card*/device/gpu_busy_percent; do
    [ -r "$f" ] || continue
    read -r util < "$f" || util=0
    util_sum=$((util_sum + util))
    count=$((count + 1))

    local base
    base="$(dirname "$f")"
    if [ -r "$base/mem_info_vram_used" ]; then
      read -r used < "$base/mem_info_vram_used" || used=0
      mem_used=$((mem_used + used))
    fi
    if [ -r "$base/mem_info_vram_total" ]; then
      read -r total < "$base/mem_info_vram_total" || total=0
      mem_total=$((mem_total + total))
    fi
    for p in "$base"/hwmon/hwmon*/power1_average; do
      [ -r "$p" ] || continue
      read -r pw < "$p" || pw=0
      power_micro=$((power_micro + pw))
    done
  done

  if [ "$count" -gt 0 ]; then
    awk -v util="$util_sum" -v count="$count" -v mem_used="$mem_used" -v mem_total="$mem_total" -v power="$power_micro" \
      'BEGIN { printf "%.2f %.0f %.0f %.2f", util / count, mem_used, mem_total, power / 1000000 }'
  else
    echo "0 0 0 0"
  fi
}

read_services() {
  if ! command -v systemctl >/dev/null 2>&1; then
    echo "[]"
    return
  fi

  local services
  services=$(systemctl list-units --type=service --state=active --no-legend --all | awk '{print $1}' || true)
  if [ -z "$services" ]; then
    echo "[]"
    return
  fi

  # Query all services details in one command to keep it fast
  # shellcheck disable=SC2086
  local show_output
  show_output=$(systemctl show $services \
    -p Id -p Description -p ActiveState -p SubState -p MemoryCurrent \
    -p LoadState -p UnitFileState -p FragmentPath -p MainPID \
    -p TasksCurrent -p TasksMax -p CPUUsageNSec -p MemoryPeak \
    -p MemoryMax -p NRestarts -p Wants -p Requires -p Conflicts \
    -p Before -p After -p ActiveEnterTimestamp -p ExecReload \
    -p StatusText -p Result -p Documentation 2>/dev/null || true)

  local services_json
  services_json=$(jq -s -R '
    gsub("\r"; "") | split("\n\n") | map(
      split("\n") | map(
        capture("^(?<key>[^=]+)=(?<value>.*)$")?
      ) | del(..|nulls) | select(length > 0) | from_entries |
      {
        name: (.Id // ""),
        description: (.Description // ""),
        state: (if .ActiveState == "active" then "Active" elif (.ActiveState == "failed" or .SubState == "failed") then "Failed" else "Inactive" end),
        subState: (if .SubState == "running" then "Running" elif .SubState == "exited" then "Exited" elif .SubState == "failed" then "Failed" else "Dead" end),
        memory: (.MemoryCurrent | tonumber? // 0),
        cpuPercent: 0,
        fragmentPath: (if .FragmentPath == "" or .FragmentPath == "/dev/null" then null else .FragmentPath end),
        mainPid: (if .MainPID == "" or .MainPID == "0" then null else (.MainPID | tonumber? // null) end),
        nRestarts: (.NRestarts | tonumber? // 0),
        tasksCurrent: (.TasksCurrent | tonumber? // null),
        tasksMax: (if .TasksMax == "" or .TasksMax == "[not set]" or .TasksMax == "infinity" or .TasksMax == "18446744073709551615" then null else (.TasksMax | tonumber? // null) end),
        requires: (if .Requires == "" or .Requires == null then [] else (.Requires | split(" ")) end),
        wants: (if .Wants == "" or .Wants == null then [] else (.Wants | split(" ")) end),
        conflicts: (if .Conflicts == "" or .Conflicts == null then [] else (.Conflicts | split(" ")) end),
        before: (if .Before == "" or .Before == null then [] else (.Before | split(" ")) end),
        after: (if .After == "" or .After == null then [] else (.After | split(" ")) end),
        documentation: (if .Documentation == "" or .Documentation == null then [] else (.Documentation | split(" ")) end),
        unitFileState: (.UnitFileState // null),
        loadState: (.LoadState // null),
        activeEnterTimestamp: (if .ActiveEnterTimestamp == "" or .ActiveEnterTimestamp == "[not set]" then null else .ActiveEnterTimestamp end),
        statusText: (if .StatusText == "" then null else .StatusText end),
        result: (if .Result == "" then null else .Result end),
        cpuUsageNSec: (.CPUUsageNSec | tonumber? // null),
        memoryPeak: (if .MemoryPeak == "" or .MemoryPeak == "[not set]" or .MemoryPeak == "18446744073709551615" then null else (.MemoryPeak | tonumber? // null) end),
        memoryLimit: (if .MemoryMax == "" or .MemoryMax == "[not set]" or .MemoryMax == "infinity" or .MemoryMax == "18446744073709551615" then null else (.MemoryMax | tonumber? // null) end),
        canStart: "Yes",
        canStop: "Yes",
        canReload: (if .ExecReload != "" and .ExecReload != null then "Yes" else "No" end)
      } |
      .name = (.name | rtrimstr(".service"))
    )
  ' <<< "$show_output" 2>/dev/null || echo "[]")

  echo "$services_json"
}

read_active_ports() {
  if ! command -v ss >/dev/null 2>&1; then
    echo "[]"
    return
  fi

  # Run ss -tulpnH and parse with awk to print space-separated lines:
  # protocol ip port process_name pid
  # Then read into jq to parse into JSON array.
  ss -tulpnH 2>/dev/null | awk '
    {
      proto = $1
      local_addr = $5
      users = $7
      
      # Extract port and IP
      idx = match(local_addr, /:[0-9]+$/)
      if (idx > 0) {
        ip = substr(local_addr, 1, idx - 1)
        port = substr(local_addr, idx + 1)
      } else {
        ip = local_addr
        port = ""
      }
      
      # Clean IP format
      if (ip == "*") ip = "0.0.0.0"
      if (ip == "[::]") ip = "::"
      
      proc_name = "unknown"
      pid = "null"
      
      # Parse users field: users:(("nginx",pid=1027,fd=6))
      if (users != "") {
        p_idx = match(users, /pid=[0-9]+/)
        if (p_idx > 0) {
          pid_part = substr(users, p_idx)
          split(pid_part, parts, /[,)]/)
          pid = substr(parts[1], 5)
        }
        
        n_idx = match(users, /\"[^\"]+\"/)
        if (n_idx > 0) {
          proc_name = substr(users, n_idx + 1, RLENGTH - 2)
        }
      }
      
      if (port != "") {
        print proto " " ip " " port " " proc_name " " pid
      }
    }
  ' | sort -u | jq -R '
    split(" ") | {
      proto: .[0],
      ip: .[1],
      port: (.[2] | tonumber),
      service: .[3],
      pid: (if .[4] == "null" then null else (.[4] | tonumber? // null) end)
    }
  ' | jq -s 'unique_by(.proto, .ip, .port) | sort_by(.port)' || echo "[]"
}

read_host_domains() {
  local domains_json="[]"
  
  # Temporary files
  local _tmp_domains=$(mktemp)
  touch "$_tmp_domains"
  
  # 1. Nginx
  if [ -d /etc/nginx ]; then
    find /etc/nginx/ -type f \( -name "*.conf" -o -name "nginx.conf" -o -path "*/sites-enabled/*" \) 2>/dev/null | while read -r conf_file; do
      awk '
        { sub(/#.*/, "") }
        /^[[:space:]]*server_name[[:space:]]+/ {
          sub(/^[[:space:]]*server_name[[:space:]]+/, "")
          for (i = 1; i <= NF; i++) {
            token = $i
            if (token ~ /;$/) {
              sub(/;$/, "", token)
              if (token != "" && token != "_" && token != "localhost" && token !~ /^\$/) {
                print token " nginx"
              }
              break
            } else {
              if (token != "" && token != "_" && token != "localhost" && token !~ /^\$/) {
                print token " nginx"
              }
            }
          }
        }
      ' "$conf_file" >> "$_tmp_domains" 2>/dev/null || true
    done
  fi

  # 2. Apache
  if [ -d /etc/apache2 ] || [ -d /etc/httpd ]; then
    find /etc/apache2/ /etc/httpd/ /etc/apache/ -type f -name "*.conf" 2>/dev/null | while read -r conf_file; do
      awk '
        { sub(/#.*/, "") }
        /^[[:space:]]*ServerName[[:space:]]+/ {
          sub(/^[[:space:]]*ServerName[[:space:]]+/, "")
          token = $1
          if (token != "" && token != "localhost" && token !~ /^\$/) {
            print token " apache"
          }
        }
        /^[[:space:]]*ServerAlias[[:space:]]+/ {
          sub(/^[[:space:]]*ServerAlias[[:space:]]+/, "")
          for (i = 1; i <= NF; i++) {
            token = $i
            if (token != "" && token != "localhost" && token !~ /^\$/) {
              print token " apache"
            }
          }
        }
      ' "$conf_file" >> "$_tmp_domains" 2>/dev/null || true
    done
  fi

  # 3. Caddy
  if [ -f /etc/caddy/Caddyfile ]; then
    awk '
      { sub(/#.*/, "") }
      /^[[:space:]]*[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(:[0-9]+)?[[:space:]]*,?[[:space:]]*{?/ {
        for (i = 1; i <= NF; i++) {
          token = $i
          sub(/,$/, "", token)
          sub(/{$/, "", token)
          if (token ~ /\.[a-zA-Z]{2,}/) {
            sub(/^https?:\/\//, "", token)
            sub(/:[0-9]+$/, "", token)
            if (token != "" && token != "localhost") {
              print token " caddy"
            }
          }
        }
      }
    ' /etc/caddy/Caddyfile >> "$_tmp_domains" 2>/dev/null || true
  fi

  if [ -s "$_tmp_domains" ]; then
    domains_json=$(sort -u "$_tmp_domains" | jq -R '
      split(" ") | {
        domain: .[0],
        type: .[1]
      }
    ' | jq -s 'unique_by(.domain) | sort_by(.domain)' || echo "[]")
  fi
  
  rm -f "$_tmp_domains"
  echo "$domains_json"
}

send_status() {
  local status="$1"
  local payload
  payload=$(jq -n \
    --arg agentId "$AGENT_ID" \
    --arg token "$AGENT_TOKEN" \
    --arg status "$status" \
    '{agentId:$agentId, token:$token, status:$status}')

  curl -fsS --max-time 5 -X POST "$SERVER_URL/api/agents/heartbeat" \
    -H 'Content-Type: application/json' \
    -d "$payload" >/dev/null 2>&1 || true
}

trap 'send_status shutdown; exit 0' TERM INT

# Prime CPU + net counters once
read PREV_CPU_TOTAL PREV_CPU_IDLE <<<"$(read_cpu)"
read PREV_RX PREV_TX <<<"$(read_net)"
read PREV_DISK_READ PREV_DISK_WRITE <<<"$(read_disk_io)"
PREV_TS=$(date +%s)
sleep 1

while true; do
  NOW=$(date +%s)
  ELAPSED=$((NOW - PREV_TS))
  [ "$ELAPSED" -le 0 ] && ELAPSED=1

  # CPU
  read CPU_TOTAL CPU_IDLE <<<"$(read_cpu)"
  DT=$((CPU_TOTAL - PREV_CPU_TOTAL))
  DI=$((CPU_IDLE - PREV_CPU_IDLE))
  if [ "$DT" -gt 0 ]; then
    CPU_PERCENT=$(awk -v d="$DT" -v i="$DI" 'BEGIN { printf "%.2f", (1 - i/d) * 100 }')
  else
    CPU_PERCENT="0"
  fi
  PREV_CPU_TOTAL=$CPU_TOTAL
  PREV_CPU_IDLE=$CPU_IDLE

  # Load
  read L1 L5 L15 _ < /proc/loadavg

  # Memory
  MEM_TOTAL_KB=$(awk '/MemTotal/{print $2}' /proc/meminfo)
  MEM_AVAIL_KB=$(awk '/MemAvailable/{print $2}' /proc/meminfo)
  SWAP_TOTAL_KB=$(awk '/SwapTotal/{print $2}' /proc/meminfo)
  SWAP_FREE_KB=$(awk '/SwapFree/{print $2}' /proc/meminfo)
  MEM_TOTAL=$(( MEM_TOTAL_KB * 1024 ))
  MEM_USED=$(( (MEM_TOTAL_KB - MEM_AVAIL_KB) * 1024 ))
  SWAP_TOTAL=$(( SWAP_TOTAL_KB * 1024 ))
  SWAP_USED=$(( (SWAP_TOTAL_KB - SWAP_FREE_KB) * 1024 ))

  # Disk on /
  read DISK_USED DISK_TOTAL <<<"$(get_disk)"

  # Disk I/O
  read DISK_READ DISK_WRITE <<<"$(read_disk_io)"
  DISK_READ_DELTA=$(( DISK_READ - PREV_DISK_READ ))
  DISK_WRITE_DELTA=$(( DISK_WRITE - PREV_DISK_WRITE ))
  [ "$DISK_READ_DELTA" -lt 0 ] && DISK_READ_DELTA=0
  [ "$DISK_WRITE_DELTA" -lt 0 ] && DISK_WRITE_DELTA=0
  DISK_READ_BPS=$(( DISK_READ_DELTA / ELAPSED ))
  DISK_WRITE_BPS=$(( DISK_WRITE_DELTA / ELAPSED ))
  PREV_DISK_READ=$DISK_READ; PREV_DISK_WRITE=$DISK_WRITE

  # Network
  read RX TX <<<"$(read_net)"
  RX_DELTA=$(( RX - PREV_RX ))
  TX_DELTA=$(( TX - PREV_TX ))
  [ "$RX_DELTA" -lt 0 ] && RX_DELTA=0
  [ "$TX_DELTA" -lt 0 ] && TX_DELTA=0
  RX_BPS=$(( RX_DELTA / ELAPSED ))
  TX_BPS=$(( TX_DELTA / ELAPSED ))
  PREV_RX=$RX; PREV_TX=$TX; PREV_TS=$NOW

  # Docker (optional)
  read_docker_containers
  DOCKER_COUNT=$(jq 'length' <<< "$CONTAINERS_DATA")
  if [ "$DOCKER_COUNT" -gt 0 ]; then
    DOCKER_CPU=$(jq '[.[].cpuPercent] | add // 0' <<< "$CONTAINERS_DATA")
    DOCKER_MEM=$(jq '[.[].memUsedBytes] | add // 0' <<< "$CONTAINERS_DATA")
    DOCKER_RX_BPS=$(jq '[.[].netRxBps] | add // 0' <<< "$CONTAINERS_DATA")
    DOCKER_TX_BPS=$(jq '[.[].netTxBps] | add // 0' <<< "$CONTAINERS_DATA")
  else
    DOCKER_CPU="0"
    DOCKER_MEM=0
    DOCKER_RX_BPS=0
    DOCKER_TX_BPS=0
  fi

  # Uptime
  UPTIME=$(awk '{print int($1)}' /proc/uptime)

  # Process count
  PROC_COUNT=$(ls -1 /proc 2>/dev/null | grep -c '^[0-9][0-9]*$')

  # Sensors / GPU (optional)
  TEMP_C="$(read_temperature_c)"
  read GPU_UTIL GPU_MEM_USED GPU_MEM_TOTAL GPU_POWER <<<"$(read_gpu)"

  SERVICES_DATA="$(read_services)"
  PORTS_DATA="$(read_active_ports)"
  DOMAINS_DATA="$(read_host_domains)"

  # Write large JSON blobs to temp files to avoid ARG_MAX limits
  _tmp_svc=$(mktemp); _tmp_cont=$(mktemp); _tmp_ports=$(mktemp); _tmp_doms=$(mktemp)
  printf '%s' "$SERVICES_DATA"   > "$_tmp_svc"
  printf '%s' "$CONTAINERS_DATA" > "$_tmp_cont"
  printf '%s' "$PORTS_DATA"      > "$_tmp_ports"
  printf '%s' "$DOMAINS_DATA"    > "$_tmp_doms"

  PAYLOAD=$(jq -n \
    --arg agentId "$AGENT_ID" \
    --arg token   "$AGENT_TOKEN" \
    --argjson cpuPercent "$CPU_PERCENT" \
    --argjson loadAvg1   "$L1" \
    --argjson loadAvg5   "$L5" \
    --argjson loadAvg15  "$L15" \
    --argjson memUsedBytes   "$MEM_USED" \
    --argjson memTotalBytes  "$MEM_TOTAL" \
    --argjson swapUsedBytes  "$SWAP_USED" \
    --argjson swapTotalBytes "$SWAP_TOTAL" \
    --argjson diskUsedBytes  "$DISK_USED" \
    --argjson diskTotalBytes "$DISK_TOTAL" \
    --argjson diskReadBps  "$DISK_READ_BPS" \
    --argjson diskWriteBps "$DISK_WRITE_BPS" \
    --argjson netRxBytes "$RX" \
    --argjson netTxBytes "$TX" \
    --argjson netRxBps   "$RX_BPS" \
    --argjson netTxBps   "$TX_BPS" \
    --argjson dockerCpuPercent "$DOCKER_CPU" \
    --argjson dockerMemUsedBytes "$DOCKER_MEM" \
    --argjson dockerNetRxBps "$DOCKER_RX_BPS" \
    --argjson dockerNetTxBps "$DOCKER_TX_BPS" \
    --argjson dockerContainerCount "$DOCKER_COUNT" \
    --argjson temperatureC "$TEMP_C" \
    --argjson gpuUtilPercent "$GPU_UTIL" \
    --argjson gpuMemUsedBytes "$GPU_MEM_USED" \
    --argjson gpuMemTotalBytes "$GPU_MEM_TOTAL" \
    --argjson gpuPowerWatts "$GPU_POWER" \
    --argjson uptimeSeconds "$UPTIME" \
    --argjson processCount  "$PROC_COUNT" \
    --slurpfile services   "$_tmp_svc" \
    --slurpfile containers "$_tmp_cont" \
    --slurpfile ports      "$_tmp_ports" \
    --slurpfile domains    "$_tmp_doms" \
    '{agentId:$agentId, token:$token, cpuPercent:$cpuPercent, loadAvg1:$loadAvg1, loadAvg5:$loadAvg5, loadAvg15:$loadAvg15, memUsedBytes:$memUsedBytes, memTotalBytes:$memTotalBytes, swapUsedBytes:$swapUsedBytes, swapTotalBytes:$swapTotalBytes, diskUsedBytes:$diskUsedBytes, diskTotalBytes:$diskTotalBytes, diskReadBps:$diskReadBps, diskWriteBps:$diskWriteBps, netRxBytes:$netRxBytes, netTxBytes:$netTxBytes, netRxBps:$netRxBps, netTxBps:$netTxBps, dockerCpuPercent:$dockerCpuPercent, dockerMemUsedBytes:$dockerMemUsedBytes, dockerNetRxBps:$dockerNetRxBps, dockerNetTxBps:$dockerNetTxBps, dockerContainerCount:$dockerContainerCount, temperatureC:$temperatureC, gpuUtilPercent:$gpuUtilPercent, gpuMemUsedBytes:$gpuMemUsedBytes, gpuMemTotalBytes:$gpuMemTotalBytes, gpuPowerWatts:$gpuPowerWatts, uptimeSeconds:$uptimeSeconds, processCount:$processCount, services:$services[0], containers:$containers[0], ports:$ports[0], domains:$domains[0]}')
  rm -f "$_tmp_svc" "$_tmp_cont" "$_tmp_ports" "$_tmp_doms"

  # Write payload to a temp file to avoid ARG_MAX limits on curl arguments
  _tmp_payload_file=$(mktemp)
  printf '%s' "$PAYLOAD" > "$_tmp_payload_file"

  # Send heartbeat and capture status code and response for debugging
  _tmp_resp=$(mktemp)
  HTTP_CODE=$(curl -sS -w "%{http_code}" -o "$_tmp_resp" --max-time 10 -X POST "$SERVER_URL/api/agents/heartbeat" \
    -H 'Content-Type: application/json' \
    -d @"$_tmp_payload_file" || echo "000")
  RESP=$(cat "$_tmp_resp")
  rm -f "$_tmp_payload_file" "$_tmp_resp"

  if [ "$HTTP_CODE" -ne 200 ]; then
    echo "Heartbeat failed (HTTP $HTTP_CODE): $RESP" >&2
  else
    if [ -n "$RESP" ]; then
      CMD_ID=$(echo "$RESP" | jq -r '.command.id // empty' 2>/dev/null || true)
      CMD_ACTION=$(echo "$RESP" | jq -r '.command.action // empty' 2>/dev/null || true)
      CMD_SERVICE=$(echo "$RESP" | jq -r '.command.service // empty' 2>/dev/null || true)

      if [ -n "$CMD_ID" ] && [ -n "$CMD_ACTION" ] && [ -n "$CMD_SERVICE" ]; then
        CMD_STATUS="done"
        if [ "$CMD_ACTION" = "start" ]; then
          systemctl start "$CMD_SERVICE" >/dev/null 2>&1 || CMD_STATUS="failed"
        elif [ "$CMD_ACTION" = "stop" ]; then
          systemctl stop "$CMD_SERVICE" >/dev/null 2>&1 || CMD_STATUS="failed"
        elif [ "$CMD_ACTION" = "restart" ]; then
          systemctl restart "$CMD_SERVICE" >/dev/null 2>&1 || CMD_STATUS="failed"
        else
          CMD_STATUS="failed"
        fi

        # Send command execution status back to server
        STATUS_PAYLOAD=$(jq -n \
          --arg agentId "$AGENT_ID" \
          --arg token "$AGENT_TOKEN" \
          --arg commandId "$CMD_ID" \
          --arg status "$CMD_STATUS" \
          '{agentId:$agentId, token:$token, commandId:$commandId, status:$status}')

        curl -fsS --max-time 10 -X POST "$SERVER_URL/api/agents/command-status" \
          -H 'Content-Type: application/json' \
          -d "$STATUS_PAYLOAD" >/dev/null 2>&1 || true
      fi
    fi
  fi

  sleep "$INTERVAL"
done
AGENT_EOF

chmod +x "$AGENT_SCRIPT"

# ---- Write uninstall script -------------------------------------------------
cat > "$UNINSTALL_SCRIPT" <<EOF
#!/usr/bin/env bash
set -e
[ "\$(id -u)" -eq 0 ] || { echo "Run as root."; exit 1; }
systemctl stop vps-monitor-agent-$USER_ID 2>/dev/null || true
systemctl disable vps-monitor-agent-$USER_ID 2>/dev/null || true
rm -f /etc/systemd/system/vps-monitor-agent-$USER_ID.service
systemctl daemon-reload || true
rm -rf $INSTALL_DIR
echo "vps-monitor-agent-$USER_ID removed."
EOF
chmod +x "$UNINSTALL_SCRIPT"

# ---- systemd service --------------------------------------------------------
log "Installing systemd service…"
cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=VPS Monitor Agent ($USER_ID)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/bin/env bash $AGENT_SCRIPT $CONFIG_FILE
Restart=always
RestartSec=5
User=root
StandardOutput=journal
StandardError=journal
KillMode=control-group

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable vps-monitor-agent-$USER_ID >/dev/null 2>&1
systemctl restart vps-monitor-agent-$USER_ID

sleep 2
if systemctl is-active --quiet vps-monitor-agent-$USER_ID; then
  ok "Agent is running."
else
  warn "Agent service is not active. Run: journalctl -u vps-monitor-agent-$USER_ID -n 50"
fi

echo
echo "${c_green}✔ Installation complete!${c_reset}"
echo "  Agent ID:      $AGENT_ID"
echo "  Dashboard:     $SERVER_URL"
echo "  Status:        sudo systemctl status vps-monitor-agent-$USER_ID"
echo "  Logs:          sudo journalctl -u vps-monitor-agent-$USER_ID -f"
echo "  Uninstall:     sudo $UNINSTALL_SCRIPT"
echo
