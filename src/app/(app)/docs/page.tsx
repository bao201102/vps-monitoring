import Link from 'next/link';
import { ArrowLeft, Code2, ShieldCheck, Terminal, Container, Settings, Users, Siren } from 'lucide-react';
import { env } from '@/lib/env';
import { redirect } from 'next/navigation';
import { getSessionFromCookies } from '@/lib/auth';
import { getOrCreateEnrollToken } from '@/lib/enroll';
import { InstallCommand } from './InstallCommand';

export const dynamic = 'force-dynamic';

export default async function DocsPage() {
  const session = await getSessionFromCookies();
  if (!session) redirect('/login');
  const userId = session.sub;
  const enrollToken = await getOrCreateEnrollToken(userId);
  const cmd = `curl -fsSL "${env.APP_URL.replace(/\/$/, '')}/api/install?interval=15&token=${enrollToken}" | sudo bash`;
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
          <li>Download the agent and register the VPS with your enrollment token.</li>
          <li>Receive its own <code className="text-ink-muted">agentId</code> and agent token.</li>
          <li>
            Install an isolated systemd service{' '}
            <code className="text-ink-muted">vps-monitor-agent-{userId}</code> that survives reboots.
          </li>
          <li>Report CPU, RAM, swap, every mount point, network, temperatures, services, containers, ports and domains every 15 seconds.</li>
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

      <Section icon={Container} title="Docker containers">
        <ul className="list-inside list-disc space-y-1 text-sm text-ink-muted">
          <li>
            <strong className="text-ink">Per-container metrics:</strong> CPU, memory and network measured by{' '}
            <code>docker stats</code>, with history for the raw retention window.
          </li>
          <li>
            <strong className="text-ink">Logs &amp; inspect:</strong> the last log lines and a trimmed{' '}
            <code>docker inspect</code> (environment variables are never collected), refreshed every few heartbeats.
          </li>
          <li>
            <strong className="text-ink">Alerts:</strong> unhealthy, restarting, or exited with a non-zero code.
          </li>
        </ul>
      </Section>

      <Section icon={Settings} title="Remote control (opt-in)">
        <p className="text-sm text-ink-muted">
          Start, stop or restart systemd services and Docker containers, and update the agent, from the dashboard.
          It is off unless the server was installed with <strong className="text-ink">Allow remote control</strong> or{' '}
          <code>ALLOW_REMOTE_COMMANDS=1</code> is set in <code>agent.conf</code> (restart the agent afterwards).
        </p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-ink-muted">
          <li>Commands are queued and picked up with the next heartbeat; unclaimed ones expire after 2 minutes.</li>
          <li>Only start / stop / restart / update are accepted, names are validated on both sides, and the agent
            refuses to control itself.</li>
          <li>Every command is recorded in the audit log with the user who sent it.</li>
        </ul>
      </Section>

      <Section icon={Siren} title="Incidents &amp; alerts">
        <ul className="list-inside list-disc space-y-1 text-sm text-ink-muted">
          <li>
            Rules: CPU, RAM, disk per mount point, temperature, server offline, failed service, container problem,
            domain down and SSL expiry. Thresholds are global with optional per-server overrides.
          </li>
          <li>
            An incident opens when a rule triggers and closes by itself when the value is back to normal, with a
            &quot;resolved&quot; notification. Metrics need to drop a few points below the limit to resolve, CPU needs
            two high samples in a row, and a problem that returns within the cooldown reopens silently.
          </li>
          <li>Channels: Telegram and a webhook (Slack, Discord, Mattermost or your own JSON receiver).</li>
          <li>Offline detection and domain checks run in the background, no open browser needed.</li>
        </ul>
      </Section>

      <Section icon={ShieldCheck} title="Security &amp; architecture">
        <ul className="list-inside list-disc space-y-1 text-sm text-ink-muted">
          <li>
            <strong className="text-ink">Outbound-only agent:</strong> the agent only makes HTTPS requests to the
            dashboard; no inbound port or SSH access is needed.
          </li>
          <li>
            <strong className="text-ink">Credentials:</strong> servers enroll with your rotatable enrollment token and
            then use their own agent token, which can also be rotated from the server page.
          </li>
          <li>
            <strong className="text-ink">Accounts:</strong> the first account (from setup) is the admin; public sign-up
            is off unless enabled. Sessions are HttpOnly cookies; changing a password or role signs out every device.
          </li>
          <li>
            <strong className="text-ink">Retention:</strong> raw metrics are kept for a few days, hourly averages for
            months, resolved incidents for 180 days.
          </li>
        </ul>
      </Section>

      <Section icon={Users} title="Administration">
        <ul className="list-inside list-disc space-y-1 text-sm text-ink-muted">
          <li>Admins create accounts, change roles, reset passwords and delete users (with all of their servers).</li>
          <li>The audit log records security-relevant actions: deletes, role changes, token rotations and
            remote commands.</li>
        </ul>
      </Section>

      <Section icon={Code2} title="API endpoints">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink-soft">Agent &amp; installation</h3>
            <Endpoint method="GET" path="/api/install?token=" desc="Installer script (enrollment token)." />
            <Endpoint method="GET" path="/api/agent/script" desc="Agent script for install and self-update." />
            <Endpoint method="POST" path="/api/agents/register" desc="Registration with the enrollment token." />
            <Endpoint method="POST" path="/api/agents/heartbeat" desc="Metrics; the reply may carry a command or a new token." />
            <Endpoint method="POST" path="/api/agents/command-status" desc="Result of a remote command." />
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink-soft">Web UI &amp; management</h3>
            <Endpoint method="GET" path="/api/agents" desc="Your servers with their latest metrics." />
            <Endpoint method="GET" path="/api/agents/:id/metrics?range=" desc="Host metrics from 1h to 90d." />
            <Endpoint method="GET" path="/api/agents/:id/containers/metrics" desc="Per-container history." />
            <Endpoint method="POST" path="/api/agents/:id/commands" desc="Queue start/stop/restart/update." />
            <Endpoint method="POST" path="/api/agents/:id/rotate-token" desc="Issue a new agent token." />
            <Endpoint method="GET" path="/api/incidents" desc="Open and resolved incidents." />
            <Endpoint method="PUT" path="/api/settings/alerts" desc="Channels and alert rules." />
            <Endpoint method="POST" path="/api/settings/alerts/test" desc="Send a test notification." />
            <Endpoint method="GET" path="/api/admin/users" desc="List users (admin)." />
            <Endpoint method="PATCH" path="/api/admin/users/:userId" desc="Change role or reset password (admin)." />
            <Endpoint method="GET" path="/api/admin/audit" desc="Audit log (admin)." />
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
