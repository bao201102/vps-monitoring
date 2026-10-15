# VPS Monitor
<img width="2995" height="1213" alt="screenshot_1778664979" src="https://github.com/user-attachments/assets/1e0f5d1b-4570-41e7-bde9-2ffec365e74c" />


> Open-source, self-hosted monitoring & management dashboard for your VPS fleet.
> Built with **Next.js 14**, **MongoDB**, and a small **bash agent** that installs in one line.

![License: MIT](https://img.shields.io/badge/License-MIT-green)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![MongoDB](https://img.shields.io/badge/MongoDB-7-green)

## ✨ Features

- **One-line install** on any systemd Linux (Ubuntu, Debian, CentOS, Rocky, Alma, Fedora, Arch…), authorised by a rotatable per-user **enrollment token**.
- **Live metrics** every 15s: CPU, memory, swap, every mounted filesystem, disk I/O, network, load, temperatures, GPU, uptime.
- **History**: raw samples for 7 days (configurable) plus hourly rollups for 90 days → 1h / 6h / 24h / 7d / 30d / 90d charts.
- **Docker**: real per-container CPU / RAM / network with history, health, logs and inspect (environment variables are never collected).
- **systemd services**: running, failed and stopped-but-enabled units with per-service CPU (from `CPUUsageNSec`) and memory history.
- **Ports & domains**: listening sockets plus domains discovered in nginx / apache / caddy, each probed every 10 minutes for HTTP status and certificate expiry.
- **Incidents & alerts**: an incident opens when a rule triggers and resolves automatically (with a "resolved" message). Rules: CPU, RAM, disk per mount, temperature, server offline, failed service, unhealthy / crashing container, domain down, SSL expiry. Per-server overrides, hysteresis and flap protection.
- **Notification channels**: Telegram and a generic webhook (Slack, Discord, Mattermost, or your own receiver).
- **Remote control (opt-in)**: start / stop / restart services and containers and update the agent from the dashboard. Disabled unless the server was installed with *Allow remote control*.
- **Multi-user**: each user only sees their own servers. Admins create users, change roles, reset passwords and read the audit log. Public sign-up is off by default.
- **Self-hosted**: your metrics live in your MongoDB.

## 🚀 Quick start (Docker)

```bash
git clone https://github.com/<you>/vps-monitoring.git
cd vps-monitoring
cp .env.example .env

# Edit .env, at minimum set:
#   JWT_SECRET=$(openssl rand -hex 64)
#   NEXT_PUBLIC_APP_URL=https://monitor.yourdomain.com

docker compose up -d --build
```

Open `http://localhost:3005`, create the admin account on the setup screen, and you're done.

The image is built from the `Dockerfile` on the host itself — no registry needed. To update:

```bash
git pull --ff-only
docker compose up -d --build
docker image prune -f
```

On a small VPS (≤ 2 GB RAM), set `BUILD_NODE_MAX_OLD_SPACE=1024` in `.env` if `next build` gets OOM-killed.

### Auto-deploy (GitHub Actions)

`.github/workflows/deploy.yml` runs lint, typecheck, unit tests, a syntax check of the agent scripts and a production build on every push and pull request. Pushes to `main` then SSH into the VPS and run `git pull --ff-only && docker compose up -d --build` in `/home/ubuntu/vps-monitoring`. That folder must be a `git clone` of this repo (with a `.env`). Required secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` (+ optional `TELEGRAM_*` for notifications).

### MongoDB outside Docker (Atlas, another VPS, …)

The app does **not** need Mongo on the same Docker network. Set **`MONGODB_URI`** in `.env` to your real connection string.

- **Firewall / Atlas IP allowlist:** allow the **public egress IP** of the machine running the `web` container.
- **TLS:** Atlas uses `mongodb+srv://…`; self-hosted often uses `mongodb://…:27017`.
- Start only the web service when you don't need the bundled Mongo:

```bash
docker compose up -d --build --no-deps web
```

**Debug:** `GET /api/health/db` returns `{ ok: true }` or a safe Mongo error (authentication vs timeout) without printing your password. The compose healthcheck uses it.

## 🖥️ Adding a server

In the dashboard click **Add server**, optionally tick **Allow remote control**, then run the command on your VPS:

```bash
curl -fsSL "https://monitor.yourdomain.com/api/install?token=enr_…" | sudo bash
```

The installer:

1. Installs `curl` and `jq` if needed and downloads the agent from `/api/agent/script`.
2. Registers the VPS with your enrollment token (gets an `agentId` + per-agent token).
3. Installs the systemd service `vps-monitor-agent-<userId>` under `/opt/vps-monitor-agent-<userId>`.

The command contains your enrollment token — treat it like a password. **Rotate token** on the Add server page invalidates old commands; installed agents keep working. Several users can install on the same VPS; each installation is isolated.

### Manage the agent on the VPS

```bash
sudo systemctl status vps-monitor-agent-<userId>    # status
sudo systemctl restart vps-monitor-agent-<userId>   # restart
sudo journalctl -u vps-monitor-agent-<userId> -f    # logs
sudo /opt/vps-monitor-agent-<userId>/uninstall.sh   # remove
```

Agent settings live in `/opt/vps-monitor-agent-<userId>/agent.conf`:

| Key                     | Default | Meaning |
| ----------------------- | ------- | ------- |
| `INTERVAL`              | `15`    | Seconds between heartbeats. |
| `ALLOW_REMOTE_COMMANDS` | `0`     | `1` lets the dashboard start/stop/restart services and containers and update the agent. Restart the agent after changing it. |
| `DETAILS_EVERY`         | `4`     | Send container logs + inspect every N heartbeats. |
| `LOGS_TAIL`             | `200`   | Log lines per container. |

Agents from before 2.0 keep reporting; use **Update agent** (needs remote control) or re-run the install command to upgrade.

## 🛠️ Local development

```bash
npm install
cp .env.example .env.local
# point MONGODB_URI to a running MongoDB
npm run dev
```

Then visit `http://localhost:3000`. Checks: `npm run lint`, `npm run typecheck`, `npm test`.

## ⚙️ Environment variables

| Variable                      | Required   | Default                                    | Description |
| ----------------------------- | ---------- | ------------------------------------------ | ----------- |
| `MONGODB_URI`                 | yes        | `mongodb://localhost:27017/vps-monitoring` | Any reachable MongoDB. |
| `JWT_SECRET`                  | yes (prod) | dev-only fallback                          | Signs session cookies. |
| `NEXT_PUBLIC_APP_URL`         | yes        | `http://localhost:3000`                    | Public URL of the dashboard (used by the installer and alert links). Use `https://` in production. |
| `AGENT_OFFLINE_AFTER_SECONDS` | no         | `60`                                       | Silence after which a server is offline. |
| `ALLOW_SIGNUP`                | no         | `false`                                    | Allow public self-registration at `/register`. |
| `METRICS_RETENTION_DAYS`      | no         | `7`                                        | Raw host + container metrics retention. |
| `ROLLUP_RETENTION_DAYS`       | no         | `90`                                       | Hourly rollup retention (30d / 90d charts). |
| `ALLOW_PRIVATE_TARGETS`       | no         | `false`                                    | Let webhooks and domain checks reach private / loopback addresses (LAN-only setups). |
| `DISABLE_SCHEDULER`           | no         | `false`                                    | Turn off background jobs in this process. Jobs already use a Mongo lease, so several replicas are safe without it. |

Alert channels and thresholds are configured per user in **Settings** and stored in MongoDB.

## 🏗️ Architecture

```
 ┌────────────────────┐  HTTPS   ┌──────────────────────────┐        ┌───────────────┐
 │  VPS (bash agent)  │ ───────► │  Next.js API             │ ─────► │  MongoDB      │
 │  /opt/vps-mon-...  │ ◄─────── │  heartbeat → ingest      │        │               │
 └────────────────────┘ commands │  scheduler (offline,     │        └───────────────┘
                                 │  rollups, domain checks) │ ─────► Telegram / webhook
                                 └────────────┬─────────────┘
                                              ▼
                                   Next.js Web UI  ◄── users (browser)
```

- **Web**: Next.js 14 App Router. Background jobs start from `src/instrumentation.ts`.
- **Ingest**: `src/lib/ingest.ts` validates heartbeats and writes in bulk; `src/lib/alerts.ts` turns them into incidents.
- **Agent**: `agent/agent.sh` (served at `/api/agent/script`), installed by `agent/install.sh` (served at `/api/install`).
- **Auth**: HttpOnly cookie with an HS256 JWT holding only the user id and a session version; role is read from the database on every request. Agents use a per-agent token that can be rotated.

## 🔒 Security notes

- The first account is created on `/setup` and is the admin. Public registration is off unless `ALLOW_SIGNUP=true`.
- Changing a password or role signs the user out everywhere.
- Each agent has its own token; compromising one VPS does not expose others.
- The agent never sends container environment variables. Remote commands are opt-in per server, limited to start/stop/restart/update, validated on both sides and recorded in the audit log.
- Webhooks and domain checks refuse private / metadata addresses by default.
- Login, setup, install and registration are rate-limited. Run the dashboard behind HTTPS (Caddy, Nginx, Traefik) and set a strong `JWT_SECRET` (`openssl rand -hex 64`).

## 📦 API endpoints

| Method | Path                                   | Auth        | Description |
| ------ | -------------------------------------- | ----------- | ----------- |
| GET    | `/api/install?token=`                  | enroll token | Installer script. |
| GET    | `/api/agent/script`                    | public      | Agent script (install + self-update). |
| POST   | `/api/agents/register`                 | enroll token | Agent registration. |
| POST   | `/api/agents/heartbeat`                | agent token | Metrics; reply may carry a command or a rotated token. |
| POST   | `/api/agents/command-status`           | agent token | Command result. |
| POST   | `/api/setup`                           | once only   | Create the admin account. |
| POST   | `/api/auth/login` / `logout` / `password` | –/session | Sign in, sign out, change password. |
| POST   | `/api/auth/signup`                     | public      | Only when `ALLOW_SIGNUP=true`. |
| GET    | `/api/agents`                          | session     | Your servers with latest metrics. |
| GET/PATCH/DELETE | `/api/agents/:id`            | session     | Details, rename/tags, delete with all data. |
| GET    | `/api/agents/:id/metrics?range=`       | session     | Host metrics (`1h`…`90d`). |
| GET    | `/api/agents/:id/containers/metrics?range=` | session | Per-container history. |
| GET    | `/api/agents/:id/services`             | session     | systemd units. |
| GET    | `/api/agents/:id/services/:name/metrics` | session   | Per-service history. |
| GET    | `/api/agents/:id/ports`                | session     | Ports, domains and their latest checks. |
| GET/POST | `/api/agents/:id/commands`           | session     | Command history / queue a command. |
| GET    | `/api/agents/:id/commands/:commandId`  | session     | Command status + output. |
| POST   | `/api/agents/:id/rotate-token`         | session     | Rotate the agent token. |
| GET    | `/api/containers`, `/api/containers/detail` | session | Containers across servers, logs + inspect. |
| GET    | `/api/incidents?status=&agentId=`      | session     | Incidents. |
| GET/PUT | `/api/settings/alerts`                | session     | Channels and rules. |
| PUT    | `/api/settings/alerts/agents/:id`      | session     | Per-server overrides. |
| POST   | `/api/settings/alerts/test`            | session     | Send a test notification. |
| POST   | `/api/settings/enroll-token`           | session     | Rotate the enrollment token. |
| GET/POST | `/api/admin/users`                   | admin       | List / create users. |
| PATCH/DELETE | `/api/admin/users/:userId`       | admin       | Change role, reset password / delete with all data. |
| GET    | `/api/admin/audit`                     | admin       | Audit log. |
| GET    | `/api/health/db`                       | public      | Database health. |

## 📄 License

MIT — do whatever you want, just don't blame us.
