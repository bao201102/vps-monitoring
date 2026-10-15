'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { AlertTriangle, ArrowUpCircle, KeyRound, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from './ConfirmDialog';
import { useAgentCommand } from './useAgentCommand';
import { timeAgo } from '@/lib/utils';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/** Agent version badge + "update agent" and "rotate token" actions. */
export function AgentMaintenance({
  agentId,
  agentVersion,
  latestAgentVersion,
  updateAvailable,
  remoteCommands,
  tokenRotationPending,
  onChanged,
}: {
  agentId: string;
  agentVersion: string | null;
  latestAgentVersion: string;
  updateAvailable: boolean;
  remoteCommands: boolean;
  tokenRotationPending: boolean;
  onChanged: () => void;
}) {
  const { run, running } = useAgentCommand(agentId, onChanged);
  const [rotateOpen, setRotateOpen] = useState(false);

  const rotate = async () => {
    const res = await fetch(`/api/agents/${encodeURIComponent(agentId)}/rotate-token`, { method: 'POST' });
    if (!res.ok) {
      toast.error('Failed to rotate token');
      throw new Error('rotate failed');
    }
    toast.success('New token issued — the agent switches to it on its next heartbeat.');
    onChanged();
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="chip-muted font-mono" title={`Latest: ${latestAgentVersion}`}>
        agent {agentVersion ?? '< 2.0'}
      </span>
      {updateAvailable && (
        <button
          type="button"
          className="btn-secondary px-2.5 py-1 text-xs"
          disabled={!remoteCommands || running !== null}
          title={
            remoteCommands
              ? `Update to ${latestAgentVersion}`
              : 'Remote control is off on this server — re-run the install command to update.'
          }
          onClick={() => void run('agent', 'update')}
        >
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUpCircle className="h-3.5 w-3.5" />}
          Update to {latestAgentVersion}
        </button>
      )}
      <button
        type="button"
        className="btn-secondary px-2.5 py-1 text-xs"
        onClick={() => setRotateOpen(true)}
        disabled={tokenRotationPending}
        title={tokenRotationPending ? 'Waiting for the agent to pick up the new token' : 'Issue a new agent token'}
      >
        <KeyRound className="h-3.5 w-3.5" />
        {tokenRotationPending ? 'Rotation pending…' : 'Rotate token'}
      </button>
      <ConfirmDialog
        open={rotateOpen}
        onOpenChange={setRotateOpen}
        title="Rotate agent token?"
        description="A new token is sent to the agent with its next heartbeat. The old token stops working once the agent uses the new one."
        cancelLabel="Cancel"
        confirmLabel="Rotate"
        tone="default"
        onConfirm={rotate}
      />
    </div>
  );
}

type IncidentRow = { id: string; title: string; detail: string; severity: string; startedAt: string };

/** Open incidents for one server, shown above the tabs. */
export function AgentIncidentsBanner({ agentId }: { agentId: string }) {
  const { data } = useSWR<{ incidents: IncidentRow[] }>(
    `/api/incidents?status=open&agentId=${encodeURIComponent(agentId)}&limit=20`,
    fetcher,
    { refreshInterval: 15000 }
  );
  const open = data?.incidents ?? [];
  if (open.length === 0) return null;
  return (
    <div className="card border-danger/30 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <AlertTriangle className="h-4 w-4 text-danger" />
          {open.length} open incident{open.length > 1 ? 's' : ''}
        </h3>
        <Link href="/incidents" className="text-xs text-accent hover:underline">
          All incidents
        </Link>
      </div>
      <ul className="space-y-1.5 text-sm">
        {open.map((i) => (
          <li key={i.id} className="flex flex-wrap items-baseline gap-x-2">
            <span className={i.severity === 'critical' ? 'font-medium text-danger' : 'font-medium text-warning'}>
              {i.title}
            </span>
            <span className="text-xs text-ink-muted">{i.detail}</span>
            <span className="text-xs text-ink-soft">· {timeAgo(i.startedAt)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
