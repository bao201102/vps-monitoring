import Link from 'next/link';
import { ArrowLeft, Boxes, Code2, ShieldCheck, Terminal, Container, Settings, Users } from 'lucide-react';
import { env } from '@/lib/env';
import { getSessionFromCookies } from '@/lib/auth';
import { InstallCommand } from './InstallCommand';

export const dynamic = 'force-dynamic';

export default async function DocsPage() {
  const session = await getSessionFromCookies();
  const userId = session?.sub ?? '';
  const cmd = `curl -fsSL "${env.APP_URL.replace(/\/$/, '')}/api/install?interval=15&userId=${userId}" | sudo bash`;
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Documentation
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          How VPS Monitor works, how to manage agents, and api capabilities.
        </p>
      </div>

      <Section icon={Terminal} title="Install the agent">
        <p className="text-sm text-ink-muted">
          SSH into the VPS as root (or with sudo) and run the registration script:
        </p>
        <InstallCommand command={cmd} />
        <p className="mt-3 text-sm text-ink-muted">
          The installation script will:
        </p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-ink-muted">
          <li>Generate a unique <code className="text-ink-muted">agentId</code> and authorization token.</li>
          <li>Auto-register the VPS with this dashboard.</li>
          <li>
            Install an isolated systemd service{' '}
            <code className="text-ink-muted">vps-monitor-agent-{userId}</code> that survives reboots.
          </li>
          <li>Report system health metrics (CPU, RAM, swap, disk, network) every 15 seconds.</li>
        </ul>

        <div className="mt-4 border-t border-border/60 pt-4">
          <h3 className="text-sm font-semibold text-ink">Manage the Agent on VPS</h3>
          <p className="mt-1 text-xs text-ink-muted">
            Each user installation is isolated under <code className="text-ink-muted">/opt/vps-monitor-agent-{userId}</code>. You can manage the service using these command-line tools:
          </p>
          <div className="mt-3 overflow-x-auto rounded-lg border border-border/80 bg-bg-soft/40 p-3 font-mono text-xs text-ink-muted space-y-1">
            <div><span className="text-accent">sudo systemctl status vps-monitor-agent-{userId}</span> <span className="text-ink-soft"># Check agent service status</span></div>
            <div><span className="text-accent">sudo systemctl restart vps-monitor-agent-{userId}</span> <span className="text-ink-soft"># Restart the agent</span></div>
            <div><span className="text-accent">sudo journalctl -u vps-monitor-agent-{userId} -f</span> <span className="text-ink-soft"># Tail live agent logs</span></div>
            <div><span className="text-accent">sudo /opt/vps-monitor-agent-{userId}/uninstall.sh</span> <span className="text-ink-soft"># Completely remove the agent and service</span></div>
          </div>
        </div>
      </Section>

      <Section icon={Container} title="Docker Container Management">
        <p className="text-sm text-ink-muted">
          The dashboard tracks active Docker containers across all your registered servers.
        </p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-ink-muted">
          <li>
            <strong className="text-ink">Real-time Metrics:</strong> Aggregates live CPU, Memory, and Network I/O metrics interpolated directly from agent heartbeats.
          </li>
          <li>
            <strong className="text-ink">Container Inspect:</strong> View image tags, port mappings, status uptime, and health checks.
          </li>
          <li>
            <strong className="text-ink">Live Logs:</strong> Read container output logs directly from the dashboard details panel.
          </li>
        </ul>
      </Section>

      <Section icon={Settings} title="System Services Control">
        <p className="text-sm text-ink-muted">
          Monitor and control systemd services on your VPS fleet without opening a SSH session.
        </p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-ink-muted">
          <li>
            <strong className="text-ink">Service List:</strong> View active, inactive, or failed services, along with their description, current CPU, and memory footprints.
          </li>
          <li>
            <strong className="text-ink">Remote Controls:</strong> Trigger <code className="text-ink-muted">start</code>, <code className="text-ink-muted">stop</code>, or <code className="text-ink-muted">restart</code> commands directly from the UI.
          </li>
          <li>
            <strong className="text-ink">Execution Pipeline:</strong> Actions are queued in the database as pending commands. The dashboard long-polls for updates and the agent reports command results back via API.
          </li>
        </ul>
      </Section>

      <Section icon={ShieldCheck} title="Security & Architecture">
        <ul className="list-inside list-disc space-y-1 text-sm text-ink-muted">
          <li>
            <strong className="text-ink">Outbound-Only Agent:</strong> The agent communicates only via outbound HTTPS requests to the dashboard. No open ports or SSH access needed on the VPS.
          </li>
          <li>
            <strong className="text-ink">Isolated Credentials:</strong> Each registered agent has its own unique token. Compromising one agent/VPS does not affect other servers.
          </li>
          <li>
            <strong className="text-ink">Web Application:</strong> Built with Next.js 14 App Router and MongoDB (using <code className="text-ink-muted">agents</code> and <code className="text-ink-muted">metrics</code> collections).
          </li>
          <li>
            <strong className="text-ink">Admin Model:</strong> First registered account is granted the admin role. Registration is disabled afterwards. Sessions are HttpOnly cookies signed with HS256 (JWT), and passwords are encrypted with bcrypt.
          </li>
        </ul>
      </Section>

      <Section icon={Users} title="Administration & Alerts">
        <ul className="list-inside list-disc space-y-1 text-sm text-ink-muted">
          <li>
            <strong className="text-ink">User Management:</strong> Administrators can view registered users, check their connected VPS counts, or delete accounts (which cascades and deletes all associated servers and metrics).
          </li>
          <li>
            <strong className="text-ink">Telegram Overload Alerts:</strong> Configure thresholds for CPU, RAM, and Disk `/` usage. When exceeded, the dashboard automatically posts alert messages.
          </li>
          <li>
            <strong className="text-ink">Alert Validation:</strong> Settings page includes a test button to trigger a validation message to your configured Telegram channel instantly before saving.
          </li>
        </ul>
      </Section>

      <Section icon={Code2} title="API endpoints">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink-soft">Agent & Installation</h3>
            <Endpoint
              method="GET"
              path="/api/install"
              desc="Returns the install/registration bash script."
            />
            <Endpoint
              method="POST"
              path="/api/agents/register"
              desc="Agent auto-registration. Generates and returns agentId + token."
            />
            <Endpoint
              method="POST"
              path="/api/agents/heartbeat"
              desc="Agent reports metrics periodically. Requires agent token."
            />
            <Endpoint
              method="POST"
              path="/api/agents/command-status"
              desc="Agent updates command execution status. Requires agent token."
            />
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink-soft">Web UI & Management</h3>
            <Endpoint
              method="GET"
              path="/api/agents"
              desc="List all agents connected to the current user."
            />
            <Endpoint
              method="GET"
              path="/api/agents/:id/metrics"
              desc="Fetch time-series metrics (CPU, memory, net, disk) for charts."
            />
            <Endpoint
              method="GET"
              path="/api/agents/:id/services"
              desc="List systemd services on the VPS."
            />
            <Endpoint
              method="POST"
              path="/api/agents/:id/services"
              desc="Trigger service control actions (start/stop/restart)."
            />
            <Endpoint
              method="GET"
              path="/api/containers"
              desc="List all containers & aggregate metrics from active agents."
            />
            <Endpoint
              method="GET"
              path="/api/containers/detail"
              desc="Get detailed container config and live logs."
            />
            <Endpoint
              method="GET"
              path="/api/settings/alerts"
              desc="Retrieve current Telegram alert configurations."
            />
            <Endpoint
              method="PUT"
              path="/api/settings/alerts"
              desc="Update thresholds and Telegram bot settings."
            />
            <Endpoint
              method="POST"
              path="/api/settings/alerts/test"
              desc="Test Telegram notifications with current settings."
            />
            <Endpoint
              method="GET"
              path="/api/admin/users"
              desc="List all registered users (Admin only)."
            />
            <Endpoint
              method="DELETE"
              path="/api/admin/users/:userId"
              desc="Delete user and all their agents/metrics (Admin only)."
            />
          </div>
        </div>
      </Section>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: any;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card card-pad">
      <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
        <Icon className="h-4 w-4 text-ink-muted" />
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Endpoint({
  method,
  path,
  desc,
}: {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  path: string;
  desc: string;
}) {
  const color =
    method === 'GET'
      ? 'text-zinc-300 bg-zinc-900/60 ring-1 ring-inset ring-border'
      : method === 'POST'
      ? 'text-zinc-200 bg-zinc-800/50 ring-1 ring-inset ring-border'
      : method === 'PUT'
      ? 'text-amber-300 bg-amber-950/40 ring-1 ring-inset ring-amber-900/50'
      : method === 'PATCH'
      ? 'text-sky-300 bg-sky-950/40 ring-1 ring-inset ring-sky-900/50'
      : method === 'DELETE'
      ? 'text-red-300 bg-red-950/40 ring-1 ring-inset ring-red-900/50'
      : 'text-zinc-400 bg-zinc-900/60 ring-1 ring-inset ring-border';
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-bg-soft/40 px-3 py-2.5">
      <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold ${color}`}>
        {method}
      </span>
      <div className="min-w-0">
        <code className="block truncate font-mono text-sm text-ink">{path}</code>
        <p className="text-xs text-ink-soft">{desc}</p>
      </div>
    </div>
  );
}
