#!/usr/bin/env bash
# ==============================================================================
# vps-monitor-agent: collects metrics and POSTs them to the dashboard.
#
# Installed by /api/install and replaced in place by the "update agent" command
# (downloaded from /api/agent/script). Configuration lives in agent.conf next
# to this file and is never overwritten by updates.
# ==============================================================================
set -u

AGENT_VERSION="2.0.1"

export LC_ALL=C
export LANG=C

SCRIPT_PATH="$(readlink -f "${BASH_SOURCE[0]}")"
SCRIPT_DIR="$(dirname "$SCRIPT_PATH")"
CONFIG_FILE="${1:-$SCRIPT_DIR/agent.conf}"
# shellcheck disable=SC1090
. "$CONFIG_FILE"

LOGS_TAIL="${LOGS_TAIL:-200}"
# Container logs + inspect are heavy; send them every N cycles only.
DETAILS_EVERY="${DETAILS_EVERY:-8}"
ALLOW_REMOTE_COMMANDS="${ALLOW_REMOTE_COMMANDS:-0}"

PREV_RX=0; PREV_TX=0; PREV_TS=0
PREV_CPU_TOTAL=0; PREV_CPU_IDLE=0
PREV_DISK_READ=0; PREV_DISK_WRITE=0
LOOP=0
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

# "/" (always, whatever its fs type — overlay/simfs on containers and OpenVZ) plus every
# real filesystem; bind-mounted files are skipped and each device is listed once
# (shortest mount point wins).
read_disks() {
  {
    df -B1 -P -T / 2>/dev/null | awk 'NR > 1'
    df -B1 -P -T \
      -x tmpfs -x devtmpfs -x overlay -x squashfs -x nsfs -x efivarfs -x fuse.lxcfs -x ramfs -x autofs 2>/dev/null \
      | awk 'NR > 1'
  } \
    | awk '$3 > 0 { printf "%s\t%s\t%s\t%s\t%s\n", $1, $2, $3, $4, $7 }' \
    | while IFS=$'\t' read -r dev fs size used mnt; do
        [ -d "$mnt" ] && printf '%s\t%s\t%s\t%s\t%s\n' "$dev" "$fs" "$size" "$used" "$mnt"
      done \
    | jq -R -s '
        split("\n") | map(select(length > 0) | split("\t")
          | {device: .[0], fsType: .[1], totalBytes: (.[2] | tonumber), usedBytes: (.[3] | tonumber), mount: .[4]})
        | group_by(.device) | map(min_by(.mount | length))
        | sort_by(.mount) | .[:32]
      ' 2>/dev/null || echo "[]"
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

# Sets CONTAINERS_DATA. $1 = 1 to include logs + inspect details.
read_docker_containers() {
  local with_details="${1:-0}"
  if ! command -v docker >/dev/null 2>&1; then
    CONTAINERS_DATA="[]"
    return
  fi

  local stats_data ps_data
  stats_data=$(timeout 5 docker stats --no-stream --format '{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}|{{.NetIO}}' 2>/dev/null || true)
  ps_data=$(timeout 5 docker ps -a --format '{{.ID}}|{{.Names}}|{{.Image}}|{{.Ports}}|{{.Status}}' 2>/dev/null || true)

  local json_payload="[]"

  while IFS= read -r line; do
    [ -z "$line" ] && continue

    local id name image ports status
    IFS='|' read -r id name image ports status <<< "$line"
    [ -z "$name" ] && continue

    local health="None"
    if [[ "$status" == *"(healthy)"* ]]; then
      health="Healthy"
    elif [[ "$status" == *"(unhealthy)"* ]]; then
      health="Unhealthy"
    fi

    local cpu="0" mem=0 rx_bps=0 tx_bps=0
    local stats_line
    stats_line=$(awk -F'|' -v n="$name" '$1 == n' <<< "$stats_data")
    if [ -n "$stats_line" ]; then
      local _n stats_cpu stats_mem stats_net
      IFS='|' read -r _n stats_cpu stats_mem stats_net <<< "$stats_line"
      cpu=$(echo "${stats_cpu:-0}" | tr -d ' %')
      [[ "$cpu" =~ ^[0-9.]+$ ]] || cpu="0"

      mem=$(to_bytes "${stats_mem%% / *}")

      local rx_bytes tx_bytes
      rx_bytes=$(to_bytes "${stats_net%% / *}")
      tx_bytes=$(to_bytes "${stats_net##* / }")

      local prev_rx="${PREV_CONT_RX[$name]:-0}" prev_tx="${PREV_CONT_TX[$name]:-0}"
      if [ "$prev_rx" -gt 0 ] && [ "$ELAPSED" -gt 0 ]; then
        local d=$(( rx_bytes - prev_rx )); [ "$d" -lt 0 ] && d=0
        rx_bps=$(( d / ELAPSED ))
      fi
      if [ "$prev_tx" -gt 0 ] && [ "$ELAPSED" -gt 0 ]; then
        local d=$(( tx_bytes - prev_tx )); [ "$d" -lt 0 ] && d=0
        tx_bps=$(( d / ELAPSED ))
      fi
      PREV_CONT_RX[$name]=$rx_bytes
      PREV_CONT_TX[$name]=$tx_bytes
    fi

    # Temp files for large JSON blobs avoid "Argument list too long" (E2BIG).
    local _tmp_logs _tmp_details _tmp_payload
    _tmp_logs=$(mktemp); _tmp_details=$(mktemp); _tmp_payload=$(mktemp)
    if [ "$with_details" = "1" ]; then
      timeout 3 docker logs --tail "$LOGS_TAIL" "$name" 2>&1 | tail -c 100000 | jq -R . | jq -s . > "$_tmp_logs" 2>/dev/null || echo "[]" > "$_tmp_logs"
      # Config.Env is dropped: it usually holds secrets (DB passwords, API keys).
      timeout 3 docker inspect --format '{{json .}}' "$name" 2>/dev/null \
        | jq '{Id, Created, Args, Config: ((.Config // {}) | del(.Env)), State, HostConfig: {RestartPolicy: .HostConfig.RestartPolicy, Memory: .HostConfig.Memory, NanoCpus: .HostConfig.NanoCpus}, NetworkSettings: {Ports: .NetworkSettings.Ports, Networks: (.NetworkSettings.Networks // {} | map_values({IPAddress, Gateway}))}, Mounts: [(.Mounts // [])[] | {Type, Source, Destination, RW}]}' \
        > "$_tmp_details" 2>/dev/null || echo "{}" > "$_tmp_details"
      [ -s "$_tmp_logs" ] || echo "[]" > "$_tmp_logs"
      [ -s "$_tmp_details" ] || echo "{}" > "$_tmp_details"
    fi
    printf '%s' "$json_payload" > "$_tmp_payload"

    json_payload=$(jq --arg id "$id" \
                      --arg name "$name" \
                      --arg image "$image" \
                      --arg ports "$ports" \
                      --arg status "$status" \
                      --arg health "$health" \
                      --argjson cpu "$cpu" \
                      --argjson mem "$mem" \
                      --argjson rx "$rx_bps" \
                      --argjson tx "$tx_bps" \
                      --arg withDetails "$with_details" \
                      --slurpfile logs    "$_tmp_logs" \
                      --slurpfile details "$_tmp_details" \
                      '. += [{id:$id, name:$name, image:$image, ports:$ports, status:$status, health:$health, cpuPercent:$cpu, memUsedBytes:$mem, netRxBps:$rx, netTxBps:$tx}
                              + (if $withDetails == "1" then {logs:($logs[0] // []), details:($details[0] // {})} else {} end)]' \
                      "$_tmp_payload" 2>/dev/null || echo "$json_payload")
    rm -f "$_tmp_logs" "$_tmp_details" "$_tmp_payload"
  done <<< "$ps_data"

  CONTAINERS_DATA="$json_payload"
}

read_temperatures() {
  # Prints a JSON object {"sensor": celsius, ...}; hottest reading per sensor label.
  local out=""
  for f in /sys/class/hwmon/hwmon*/temp*_input; do
    [ -r "$f" ] || continue
    local v label name base
    read -r v < "$f" 2>/dev/null || continue
    base="${f%_input}"
    name="$(cat "$(dirname "$f")/name" 2>/dev/null || echo hwmon)"
    label="$(cat "${base}_label" 2>/dev/null || echo "$(basename "$base")")"
    out+="$name $label"$'\t'"$v"$'\n'
  done
  for f in /sys/class/thermal/thermal_zone*/temp; do
    [ -r "$f" ] || continue
    local v type
    read -r v < "$f" 2>/dev/null || continue
    type="$(cat "$(dirname "$f")/type" 2>/dev/null || echo zone)"
    out+="$type"$'\t'"$v"$'\n'
  done
  printf '%s' "$out" | jq -R -s '
    split("\n") | map(select(length > 0) | split("\t") | {k: .[0], v: ((.[1] | tonumber? // 0) | if . > 1000 then . / 1000 else . end)})
    | map(select(.v > 0 and .v < 150))
    | group_by(.k) | map({key: .[0].k, value: ((map(.v) | max) * 10 | round / 10)}) | from_entries
  ' 2>/dev/null || echo "{}"
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

# Running/failed units plus enabled units that are currently stopped (so they can be started again).
read_services() {
  if ! command -v systemctl >/dev/null 2>&1; then
    echo "[]"
    return
  fi

  local services
  services=$(systemctl list-units --type=service --all --no-legend --plain 2>/dev/null | awk '$2 != "not-found" { print $1 }' || true)
  if [ -z "$services" ]; then
    echo "[]"
    return
  fi

  # Query all services details in one command to keep it fast
  local show_output
  # shellcheck disable=SC2086
  show_output=$(systemctl show $services \
    -p Id -p Description -p ActiveState -p SubState -p MemoryCurrent \
    -p LoadState -p UnitFileState -p FragmentPath -p MainPID \
    -p TasksCurrent -p TasksMax -p CPUUsageNSec -p MemoryPeak \
    -p MemoryMax -p NRestarts -p Wants -p Requires -p Conflicts \
    -p Before -p After -p ActiveEnterTimestamp -p ExecReload \
    -p StatusText -p Result -p Documentation 2>/dev/null || true)

  jq -s -R '
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
        cpuUsageNSec: (if .CPUUsageNSec == "" or .CPUUsageNSec == "[not set]" or .CPUUsageNSec == "18446744073709551615" then null else (.CPUUsageNSec | tonumber? // null) end),
        memoryPeak: (if .MemoryPeak == "" or .MemoryPeak == "[not set]" or .MemoryPeak == "18446744073709551615" then null else (.MemoryPeak | tonumber? // null) end),
        memoryLimit: (if .MemoryMax == "" or .MemoryMax == "[not set]" or .MemoryMax == "infinity" or .MemoryMax == "18446744073709551615" then null else (.MemoryMax | tonumber? // null) end),
        canStart: "Yes",
        canStop: "Yes",
        canReload: (if .ExecReload != "" and .ExecReload != null then "Yes" else "No" end)
      } |
      .name = (.name | rtrimstr(".service"))
    ) | map(select(.name != "" and (.state != "Inactive" or .unitFileState == "enabled")))
  ' <<< "$show_output" 2>/dev/null || echo "[]"
}

read_active_ports() {
  if ! command -v ss >/dev/null 2>&1; then
    echo "[]"
    return
  fi

  # protocol ip port process_name pid
  ss -tulpnH 2>/dev/null | awk '
    {
      proto = $1
      local_addr = $5
      users = $7

      idx = match(local_addr, /:[0-9]+$/)
      if (idx > 0) {
        ip = substr(local_addr, 1, idx - 1)
        port = substr(local_addr, idx + 1)
      } else {
        ip = local_addr
        port = ""
      }

      if (ip == "*") ip = "0.0.0.0"
      if (ip == "[::]") ip = "::"
      sub(/%.*$/, "", ip)

      proc_name = "unknown"
      pid = "null"

      # users:(("nginx",pid=1027,fd=6))
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
  ' | jq -s 'unique_by(.proto, .ip, .port) | sort_by(.port)' 2>/dev/null || echo "[]"
}

read_host_domains() {
  local domains_json="[]"
  local _tmp_domains
  _tmp_domains=$(mktemp)

  # 1. Nginx
  if [ -d /etc/nginx ]; then
    find /etc/nginx/ -type f \( -name "*.conf" -o -path "*/sites-enabled/*" \) 2>/dev/null | while read -r conf_file; do
      awk '
        { sub(/#.*/, "") }
        /^[[:space:]]*server_name[[:space:]]+/ {
          sub(/^[[:space:]]*server_name[[:space:]]+/, "")
          for (i = 1; i <= NF; i++) {
            token = $i
            last = (token ~ /;$/)
            sub(/;$/, "", token)
            if (token != "" && token != "_" && token != "localhost" && token !~ /^\$/) {
              curr_names[++names_len] = token
            }
            if (last) break
          }
        }
        /^[[:space:]]*proxy_pass[[:space:]]+/ {
          sub(/^[[:space:]]*proxy_pass[[:space:]]+/, "")
          sub(/;$/, "", $1)
          target = $1
          if (names_len > 0) {
            for (j = 1; j <= names_len; j++) print curr_names[j] " nginx " target
            delete curr_names
            names_len = 0
          }
        }
        END {
          for (j = 1; j <= names_len; j++) print curr_names[j] " nginx static"
        }
      ' "$conf_file" >> "$_tmp_domains" 2>/dev/null || true
    done
  fi

  # 2. Apache
  if [ -d /etc/apache2 ] || [ -d /etc/httpd ]; then
    find /etc/apache2/ /etc/httpd/ -type f -name "*.conf" 2>/dev/null | while read -r conf_file; do
      awk '
        { sub(/#.*/, "") }
        /^[[:space:]]*ServerName[[:space:]]+/ {
          sub(/^[[:space:]]*ServerName[[:space:]]+/, "")
          curr_name = $1
        }
        /^[[:space:]]*ServerAlias[[:space:]]+/ {
          sub(/^[[:space:]]*ServerAlias[[:space:]]+/, "")
          for (i = 1; i <= NF; i++) {
            token = $i
            if (token != "" && token != "localhost" && token !~ /^\$/) curr_alias[++alias_len] = token
          }
        }
        /^[[:space:]]*ProxyPass[[:space:]]+/ {
          sub(/^[[:space:]]*ProxyPass[[:space:]]+/, "")
          target = ($1 ~ /^\//) ? $2 : $1
          if (curr_name != "" && curr_name != "localhost") { print curr_name " apache " target; curr_name = "" }
          for (j = 1; j <= alias_len; j++) print curr_alias[j] " apache " target
          delete curr_alias
          alias_len = 0
        }
        END {
          if (curr_name != "" && curr_name != "localhost") print curr_name " apache static"
          for (j = 1; j <= alias_len; j++) print curr_alias[j] " apache static"
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
            if (token != "" && token != "localhost") curr_caddy[++caddy_len] = token
          }
        }
      }
      /^[[:space:]]*reverse_proxy[[:space:]]+/ {
        sub(/^[[:space:]]*reverse_proxy[[:space:]]+/, "")
        target = $1
        for (j = 1; j <= caddy_len; j++) print curr_caddy[j] " caddy " target
        delete curr_caddy
        caddy_len = 0
      }
      END {
        for (j = 1; j <= caddy_len; j++) print curr_caddy[j] " caddy static"
      }
    ' /etc/caddy/Caddyfile >> "$_tmp_domains" 2>/dev/null || true
  fi

  if [ -s "$_tmp_domains" ]; then
    domains_json=$(sort -u "$_tmp_domains" | jq -R '
      split(" ") | {
        domain: .[0],
        type: .[1],
        target: (.[2] // "static")
      }
    ' | jq -s 'unique_by(.domain) | sort_by(.domain)' 2>/dev/null || echo "[]")
  fi

  rm -f "$_tmp_domains"
  echo "$domains_json"
}

post_json() {
  # $1 = path, $2 = file with JSON body. Prints "<http_code>\n<body>".
  # Retries once after a network error or 5xx so a single blip doesn't cost a heartbeat.
  local _resp code attempt
  _resp=$(mktemp)
  for attempt in 1 2; do
    # curl still prints %{http_code} ("000" when nothing came back) on failure, so ignore its exit code.
    code=$(curl -sS -w "%{http_code}" -o "$_resp" --connect-timeout 5 --max-time 15 -X POST "$SERVER_URL$1" \
      -H 'Content-Type: application/json' -d @"$2" 2>/dev/null)
    [[ "$code" =~ ^[0-9]{3}$ ]] || code="000"
    [ "$code" = "000" ] || [ "${code:0:1}" = "5" ] || break
    [ "$attempt" -eq 1 ] && sleep 2
  done
  printf '%s\n' "$code"
  cat "$_resp"
  rm -f "$_resp"
}

send_status() {
  local status="$1" _tmp
  _tmp=$(mktemp)
  jq -n --arg agentId "$AGENT_ID" --arg token "$AGENT_TOKEN" --arg status "$status" --arg v "$AGENT_VERSION" \
    '{agentId:$agentId, token:$token, status:$status, agentVersion:$v}' > "$_tmp"
  curl -fsS --max-time 5 -X POST "$SERVER_URL/api/agents/heartbeat" \
    -H 'Content-Type: application/json' -d @"$_tmp" >/dev/null 2>&1 || true
  rm -f "$_tmp"
}

# Download the latest agent from the dashboard and swap it in. systemd restarts us.
self_update() {
  local tmp
  tmp=$(mktemp)
  if curl -fsS --max-time 30 "$SERVER_URL/api/agent/script" -o "$tmp" \
     && grep -q '^AGENT_VERSION=' "$tmp" \
     && bash -n "$tmp"; then
    install -m 755 "$tmp" "$SCRIPT_PATH"
    rm -f "$tmp"
    return 0
  fi
  rm -f "$tmp"
  return 1
}

report_command() {
  local id="$1" status="$2" output="$3" _tmp
  _tmp=$(mktemp)
  jq -n --arg agentId "$AGENT_ID" --arg token "$AGENT_TOKEN" --arg commandId "$id" --arg status "$status" \
    --arg output "${output:0:3900}" \
    '{agentId:$agentId, token:$token, commandId:$commandId, status:$status, output:$output}' > "$_tmp"
  curl -fsS --max-time 10 -X POST "$SERVER_URL/api/agents/command-status" \
    -H 'Content-Type: application/json' -d @"$_tmp" >/dev/null 2>&1 || true
  rm -f "$_tmp"
}

run_command() {
  local id="$1" kind="$2" action="$3" target="$4"
  local status="failed" output="" restart_after=0

  if [ "$ALLOW_REMOTE_COMMANDS" != "1" ]; then
    output="Remote commands are disabled on this agent (set ALLOW_REMOTE_COMMANDS=1 in agent.conf)."
  elif [ -n "$target" ] && ! [[ "$target" =~ ^[A-Za-z0-9@._:-]+$ ]]; then
    output="Rejected target name."
  elif [[ "$target" == vps-monitor-agent* ]]; then
    output="Refusing to control the monitoring agent itself."
  else
    case "$kind:$action" in
      service:start|service:stop|service:restart)
        if output=$(timeout 60 systemctl "$action" -- "$target" 2>&1); then status="done"; fi
        ;;
      container:start|container:stop|container:restart)
        if output=$(timeout 90 docker "$action" -- "$target" 2>&1); then status="done"; fi
        ;;
      agent:update)
        if self_update; then
          status="done"; output="Agent updated, restarting."; restart_after=1
        else
          output="Failed to download or validate the new agent script."
        fi
        ;;
      *)
        output="Unsupported command: $kind $action"
        ;;
    esac
  fi

  report_command "$id" "$status" "$output"
  if [ "$restart_after" = "1" ]; then
    exit 0
  fi
}

trap 'send_status shutdown; exit 0' TERM INT

REMOTE_COMMANDS_JSON=false
[ "$ALLOW_REMOTE_COMMANDS" = "1" ] && REMOTE_COMMANDS_JSON=true

# Prime CPU + net counters once
read -r PREV_CPU_TOTAL PREV_CPU_IDLE <<<"$(read_cpu)"
read -r PREV_RX PREV_TX <<<"$(read_net)"
read -r PREV_DISK_READ PREV_DISK_WRITE <<<"$(read_disk_io)"
PREV_TS=$(date +%s)
sleep 1

while true; do
  NOW=$(date +%s)
  ELAPSED=$((NOW - PREV_TS))
  [ "$ELAPSED" -le 0 ] && ELAPSED=1

  # CPU
  read -r CPU_TOTAL CPU_IDLE <<<"$(read_cpu)"
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
  read -r L1 L5 L15 _ < /proc/loadavg

  # Memory
  MEM_TOTAL_KB=$(awk '/MemTotal/{print $2}' /proc/meminfo)
  MEM_AVAIL_KB=$(awk '/MemAvailable/{print $2}' /proc/meminfo)
  SWAP_TOTAL_KB=$(awk '/SwapTotal/{print $2}' /proc/meminfo)
  SWAP_FREE_KB=$(awk '/SwapFree/{print $2}' /proc/meminfo)
  MEM_TOTAL=$(( MEM_TOTAL_KB * 1024 ))
  MEM_USED=$(( (MEM_TOTAL_KB - MEM_AVAIL_KB) * 1024 ))
  SWAP_TOTAL=$(( SWAP_TOTAL_KB * 1024 ))
  SWAP_USED=$(( (SWAP_TOTAL_KB - SWAP_FREE_KB) * 1024 ))

  # Disk on / (kept for charts) + every mount point
  read -r DISK_USED DISK_TOTAL <<<"$(get_disk)"
  DISK_USED="${DISK_USED:-0}"; DISK_TOTAL="${DISK_TOTAL:-0}"
  DISKS_DATA="$(read_disks)"

  # Disk I/O
  read -r DISK_READ DISK_WRITE <<<"$(read_disk_io)"
  DISK_READ_DELTA=$(( DISK_READ - PREV_DISK_READ ))
  DISK_WRITE_DELTA=$(( DISK_WRITE - PREV_DISK_WRITE ))
  [ "$DISK_READ_DELTA" -lt 0 ] && DISK_READ_DELTA=0
  [ "$DISK_WRITE_DELTA" -lt 0 ] && DISK_WRITE_DELTA=0
  DISK_READ_BPS=$(( DISK_READ_DELTA / ELAPSED ))
  DISK_WRITE_BPS=$(( DISK_WRITE_DELTA / ELAPSED ))
  PREV_DISK_READ=$DISK_READ; PREV_DISK_WRITE=$DISK_WRITE

  # Network
  read -r RX TX <<<"$(read_net)"
  RX_DELTA=$(( RX - PREV_RX ))
  TX_DELTA=$(( TX - PREV_TX ))
  [ "$RX_DELTA" -lt 0 ] && RX_DELTA=0
  [ "$TX_DELTA" -lt 0 ] && TX_DELTA=0
  RX_BPS=$(( RX_DELTA / ELAPSED ))
  TX_BPS=$(( TX_DELTA / ELAPSED ))
  PREV_RX=$RX; PREV_TX=$TX; PREV_TS=$NOW

  # Docker (optional). Logs + inspect only every DETAILS_EVERY cycles.
  SEND_DETAILS=0
  if [ $(( LOOP % DETAILS_EVERY )) -eq 0 ]; then SEND_DETAILS=1; fi
  LOOP=$(( LOOP + 1 ))
  read_docker_containers "$SEND_DETAILS"
  DOCKER_COUNT=$(jq 'length' <<< "$CONTAINERS_DATA" 2>/dev/null || echo 0)
  if [ "$DOCKER_COUNT" -gt 0 ]; then
    read -r DOCKER_CPU DOCKER_MEM DOCKER_RX_BPS DOCKER_TX_BPS <<<"$(jq -r '[([.[].cpuPercent] | add // 0), ([.[].memUsedBytes] | add // 0), ([.[].netRxBps] | add // 0), ([.[].netTxBps] | add // 0)] | @tsv' <<< "$CONTAINERS_DATA")"
  else
    DOCKER_CPU="0"; DOCKER_MEM=0; DOCKER_RX_BPS=0; DOCKER_TX_BPS=0
  fi

  # Uptime / processes
  UPTIME=$(awk '{print int($1)}' /proc/uptime)
  PROC_COUNT=$(find /proc -maxdepth 1 -name '[0-9]*' -type d 2>/dev/null | wc -l)

  # Sensors / GPU (optional)
  TEMPS_DATA="$(read_temperatures)"
  TEMP_C=$(jq '[.[]] | max // 0' <<< "$TEMPS_DATA" 2>/dev/null || echo 0)
  read -r GPU_UTIL GPU_MEM_USED GPU_MEM_TOTAL GPU_POWER <<<"$(read_gpu)"

  SERVICES_DATA="$(read_services)"
  PORTS_DATA="$(read_active_ports)"
  DOMAINS_DATA="$(read_host_domains)"

  # Write large JSON blobs to temp files to avoid ARG_MAX limits
  _tmp_svc=$(mktemp); _tmp_cont=$(mktemp); _tmp_ports=$(mktemp); _tmp_doms=$(mktemp); _tmp_disks=$(mktemp); _tmp_temps=$(mktemp)
  printf '%s' "$SERVICES_DATA"   > "$_tmp_svc"
  printf '%s' "$CONTAINERS_DATA" > "$_tmp_cont"
  printf '%s' "$PORTS_DATA"      > "$_tmp_ports"
  printf '%s' "$DOMAINS_DATA"    > "$_tmp_doms"
  printf '%s' "$DISKS_DATA"      > "$_tmp_disks"
  printf '%s' "$TEMPS_DATA"      > "$_tmp_temps"

  _tmp_payload_file=$(mktemp)
  jq -n \
    --arg agentId "$AGENT_ID" \
    --arg token   "$AGENT_TOKEN" \
    --arg agentVersion "$AGENT_VERSION" \
    --argjson remoteCommands "$REMOTE_COMMANDS_JSON" \
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
    --slurpfile disks      "$_tmp_disks" \
    --slurpfile temps      "$_tmp_temps" \
    '{agentId:$agentId, token:$token, agentVersion:$agentVersion, remoteCommands:$remoteCommands,
      cpuPercent:$cpuPercent, loadAvg1:$loadAvg1, loadAvg5:$loadAvg5, loadAvg15:$loadAvg15,
      memUsedBytes:$memUsedBytes, memTotalBytes:$memTotalBytes, swapUsedBytes:$swapUsedBytes, swapTotalBytes:$swapTotalBytes,
      diskUsedBytes:$diskUsedBytes, diskTotalBytes:$diskTotalBytes, disks:($disks[0] // []),
      diskReadBps:$diskReadBps, diskWriteBps:$diskWriteBps,
      netRxBytes:$netRxBytes, netTxBytes:$netTxBytes, netRxBps:$netRxBps, netTxBps:$netTxBps,
      dockerCpuPercent:$dockerCpuPercent, dockerMemUsedBytes:$dockerMemUsedBytes, dockerNetRxBps:$dockerNetRxBps, dockerNetTxBps:$dockerNetTxBps,
      dockerContainerCount:$dockerContainerCount,
      temperatureC:$temperatureC, temperatures:($temps[0] // {}),
      gpuUtilPercent:$gpuUtilPercent, gpuMemUsedBytes:$gpuMemUsedBytes, gpuMemTotalBytes:$gpuMemTotalBytes, gpuPowerWatts:$gpuPowerWatts,
      uptimeSeconds:$uptimeSeconds, processCount:$processCount,
      services:($services[0] // []), containers:($containers[0] // []), ports:($ports[0] // []), domains:($domains[0] // [])}' \
    > "$_tmp_payload_file"
  rm -f "$_tmp_svc" "$_tmp_cont" "$_tmp_ports" "$_tmp_doms" "$_tmp_disks" "$_tmp_temps"

  RESULT="$(post_json /api/agents/heartbeat "$_tmp_payload_file")"
  rm -f "$_tmp_payload_file"
  HTTP_CODE="$(head -n1 <<< "$RESULT")"
  RESP="$(tail -n +2 <<< "$RESULT")"

  if [ "$HTTP_CODE" != "200" ]; then
    echo "Heartbeat failed (HTTP $HTTP_CODE): $RESP" >&2
  elif [ -n "$RESP" ]; then
    # Token rotation: persist the new token, use it from the next heartbeat on.
    NEW_TOKEN=$(jq -r '.newToken // empty' <<< "$RESP" 2>/dev/null || true)
    if [ -n "$NEW_TOKEN" ] && [ "$NEW_TOKEN" != "$AGENT_TOKEN" ] && [[ "$NEW_TOKEN" =~ ^tok_[A-Za-z0-9_-]+$ ]]; then
      if sed -i "s|^AGENT_TOKEN=.*|AGENT_TOKEN=\"$NEW_TOKEN\"|" "$CONFIG_FILE"; then
        AGENT_TOKEN="$NEW_TOKEN"
        echo "Agent token rotated." >&2
      fi
    fi

    CMD_ID=$(jq -r '.command.id // empty' <<< "$RESP" 2>/dev/null || true)
    if [ -n "$CMD_ID" ]; then
      run_command "$CMD_ID" \
        "$(jq -r '.command.kind // "service"' <<< "$RESP")" \
        "$(jq -r '.command.action // empty' <<< "$RESP")" \
        "$(jq -r '.command.target // empty' <<< "$RESP")"
    fi
  fi

  sleep "$INTERVAL"
done
