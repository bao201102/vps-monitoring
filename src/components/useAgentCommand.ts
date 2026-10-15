'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';

export type CommandKind = 'service' | 'container' | 'agent';

const POLL_MS = 2000;
const TIMEOUT_MS = 150_000;

/**
 * Queue a command for an agent and follow it until the agent reports back.
 * The agent only picks commands up on its next heartbeat, so this can take a
 * full reporting interval.
 */
export function useAgentCommand(agentId: string, onFinished?: () => void) {
  const [running, setRunning] = useState<string | null>(null);

  const run = useCallback(
    async (kind: CommandKind, action: string, target = '') => {
      const key = `${kind}:${action}:${target}`;
      setRunning(key);
      const label = target ? `${action} ${target}` : `${kind} ${action}`;
      const toastId = toast.loading(`Queued: ${label} — waiting for the agent…`);
      try {
        const res = await fetch(`/api/agents/${encodeURIComponent(agentId)}/commands`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind, action, target }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.id) {
          toast.error(data.error ?? 'Failed to queue command', { id: toastId });
          return false;
        }

        const started = Date.now();
        while (Date.now() - started < TIMEOUT_MS) {
          await new Promise((r) => setTimeout(r, POLL_MS));
          const s = await fetch(`/api/agents/${encodeURIComponent(agentId)}/commands/${data.id}`)
            .then((r) => r.json())
            .catch(() => null);
          if (!s) continue;
          if (s.status === 'done') {
            toast.success(`Done: ${label}`, { id: toastId, description: s.output || undefined });
            onFinished?.();
            return true;
          }
          if (s.status === 'failed' || s.status === 'expired') {
            toast.error(`${s.status === 'expired' ? 'Expired' : 'Failed'}: ${label}`, {
              id: toastId,
              description: s.output || undefined,
            });
            onFinished?.();
            return false;
          }
        }
        toast.error(`No answer from the agent for ${label}`, { id: toastId });
        return false;
      } finally {
        setRunning(null);
      }
    },
    [agentId, onFinished]
  );

  return { run, running };
}
