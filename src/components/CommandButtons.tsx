'use client';

import { useState } from 'react';
import { Loader2, Play, RotateCw, Square, ShieldOff } from 'lucide-react';
import { ConfirmDialog } from './ConfirmDialog';
import { useAgentCommand, type CommandKind } from './useAgentCommand';

type Action = 'start' | 'stop' | 'restart';

const ICONS = { start: Play, stop: Square, restart: RotateCw } as const;

/** Start / Stop / Restart buttons for a systemd unit or a docker container. */
export function CommandButtons({
  agentId,
  kind,
  target,
  remoteCommands,
  isRunning,
  onDone,
}: {
  agentId: string;
  kind: Exclude<CommandKind, 'agent'>;
  target: string;
  remoteCommands: boolean;
  isRunning: boolean;
  onDone?: () => void;
}) {
  const { run, running } = useAgentCommand(agentId, onDone);
  const [confirm, setConfirm] = useState<Action | null>(null);

  if (!remoteCommands) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-border bg-bg-card px-3 py-2.5 text-xs text-ink-muted">
        <ShieldOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Remote control is off for this server. Set <code className="font-mono">ALLOW_REMOTE_COMMANDS=1</code> in the
          agent&apos;s <code className="font-mono">agent.conf</code> and restart the agent to enable these actions.
        </span>
      </div>
    );
  }

  const actions: Action[] = isRunning ? ['restart', 'stop'] : ['start'];

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => {
          const Icon = ICONS[a];
          const busy = running === `${kind}:${a}:${target}`;
          return (
            <button
              key={a}
              type="button"
              disabled={running !== null}
              onClick={() => (a === 'start' ? void run(kind, a, target) : setConfirm(a))}
              className={a === 'stop' ? 'btn-danger px-3 py-1.5 text-xs' : 'btn-secondary px-3 py-1.5 text-xs'}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
              <span className="capitalize">{a}</span>
            </button>
          );
        })}
      </div>
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`${confirm === 'stop' ? 'Stop' : 'Restart'} ${target}?`}
        description={
          <>
            This runs <code className="font-mono">{kind === 'service' ? `systemctl ${confirm}` : `docker ${confirm}`} {target}</code>{' '}
            on the server at its next heartbeat.
          </>
        }
        cancelLabel="Cancel"
        confirmLabel={confirm === 'stop' ? 'Stop' : 'Restart'}
        tone={confirm === 'stop' ? 'danger' : 'default'}
        onConfirm={async () => {
          const a = confirm;
          setConfirm(null);
          if (a) await run(kind, a, target);
        }}
      />
    </>
  );
}
