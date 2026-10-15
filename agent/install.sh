#!/usr/bin/env bash
# ==============================================================================
# VPS Monitor Agent - one-line installer
#
# Usage (on the target VPS):
#   curl -fsSL "<DASHBOARD_URL>/api/install?token=<ENROLL_TOKEN>" | sudo bash
#
# This installer:
#   - Installs deps (curl, jq) if missing
#   - Registers with the dashboard using the enrollment token (gets agentId + token)
#   - Downloads the agent script into /opt/vps-monitor-agent-$USER_ID/
#   - Installs and starts a systemd service that survives reboots
# ==============================================================================
set -euo pipefail

SERVER_URL="__SERVER_URL__"
USER_ID="__USER_ID__"
ENROLL_TOKEN="__ENROLL_TOKEN__"
INTERVAL="__INTERVAL__"
ALLOW_REMOTE_COMMANDS="__ALLOW_COMMANDS__"
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
  # Only reuse the agent id; everything else comes from this fresh install command.
  # shellcheck disable=SC1090
  AGENT_ID="$( . "$CONFIG_FILE" >/dev/null 2>&1; printf '%s' "${AGENT_ID:-}" )"
fi

if [ -z "${AGENT_ID:-}" ]; then
  AGENT_ID="vps_$(head -c 16 /dev/urandom | od -An -tx1 | tr -d ' \n')"
fi

# ---- Download agent script --------------------------------------------------
log "Downloading agent…"
_tmp_agent="$(mktemp)"
curl -fsSL --max-time 60 "$SERVER_URL/api/agent/script" -o "$_tmp_agent"   || die "Failed to download the agent from $SERVER_URL/api/agent/script"
bash -n "$_tmp_agent" || die "Downloaded agent script failed a syntax check."
install -m 755 "$_tmp_agent" "$AGENT_SCRIPT"
rm -f "$_tmp_agent"
ok "Agent $(awk -F\" '/^AGENT_VERSION=/{print $2; exit}' "$AGENT_SCRIPT") installed."

# ---- Register with dashboard ------------------------------------------------
log "Registering with $SERVER_URL …"

REG_PAYLOAD=$(jq -n \
  --arg agentId "$AGENT_ID" \
  --arg enrollToken "$ENROLL_TOKEN" \
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
  '{agentId:$agentId, enrollToken:$enrollToken, hostname:$hostname, os:$os, osVersion:$osVersion, kernel:$kernel, arch:$arch, cpuModel:$cpuModel, cpuCores:$cpuCores, totalMemoryBytes:$totalMemoryBytes, totalDiskBytes:$totalDiskBytes, publicIp:$publicIp, privateIp:$privateIp}')

REG_RESPONSE="$(curl -sS --max-time 20 -X POST "$SERVER_URL/api/agents/register" \
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
LOGS_TAIL="200"
# Send container logs/inspect every N heartbeats.
DETAILS_EVERY="4"
# Set to 1 to let the dashboard start/stop/restart services and containers
# and update this agent remotely. Restart the agent service after changing it.
ALLOW_REMOTE_COMMANDS="$ALLOW_REMOTE_COMMANDS"
EOF
chmod 600 "$CONFIG_FILE"

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
