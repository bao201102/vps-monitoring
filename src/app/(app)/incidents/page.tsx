'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, BellOff } from 'lucide-react';
import { formatDistanceStrict } from 'date-fns';
import { cn, timeAgo } from '@/lib/utils';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Incident = {
  id: string;
  agentId: string;
  server: string;
  type: string;
  key: string;
  status: 'open' | 'resolved';
  severity: 'warning' | 'critical';
  title: string;
  detail: string;
  startedAt: string;
  resolvedAt: string | null;
  notified: boolean;
};

const TYPE_LABELS: Record<string, string> = {
  offline: 'Offline',
  cpu: 'CPU',
  ram: 'RAM',
  disk: 'Disk',
  temp: 'Temperature',
  service: 'Service',
  container: 'Container',
  domain_down: 'Domain',
  ssl_expiry: 'SSL',
};

const TAB_FOR_TYPE: Record<string, string> = {
  service: 'service',
  container: 'containers',
  domain_down: 'ports',
  ssl_expiry: 'ports',
  disk: 'disk',
};

export default function IncidentsPage() {
  const [status, setStatus] = useState<'open' | 'all'>('open');
  const { data, isLoading } = useSWR<{ incidents: Incident[] }>(`/api/incidents?status=${status}`, fetcher, {
    refreshInterval: 15000,
  });
  const incidents = useMemo(() => data?.incidents ?? [], [data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Incidents</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Problems detected on your servers. An incident opens when a rule triggers and resolves on its own when
            things are back to normal.
          </p>
        </div>
        <div className="flex rounded-xl border border-border bg-bg-card p-1 text-xs font-semibold">
          {(['open', 'all'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={cn(
                'rounded-lg px-3 py-1.5 transition-colors',
                status === s ? 'bg-bg-muted text-ink' : 'text-ink-soft hover:text-ink'
              )}
            >
              {s === 'open' ? 'Open' : 'All (180 days)'}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="card flex items-center justify-center py-24 text-ink-muted">
          <Loader2 className="mr-2 h-4 w-4 animate-spin text-accent" />
          Loading incidents…
        </div>
      ) : incidents.length === 0 ? (
        <div className="card flex flex-col items-center justify-center gap-2 py-20 text-ink-muted">
          <CheckCircle2 className="h-8 w-8 text-success" />
          <p className="text-sm font-semibold">{status === 'open' ? 'No open incidents' : 'No incidents recorded'}</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-ink-soft">
              <tr>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Server</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Problem</th>
                <th className="px-4 py-3">Started</th>
                <th className="px-4 py-3">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {incidents.map((i) => {
                const end = i.resolvedAt ? new Date(i.resolvedAt) : new Date();
                const tab = TAB_FOR_TYPE[i.type];
                return (
                  <tr key={i.id} className="align-top">
                    <td className="px-4 py-3">
                      {i.status === 'open' ? (
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 text-xs font-semibold',
                            i.severity === 'critical' ? 'text-danger' : 'text-warning'
                          )}
                        >
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Open
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-success">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Resolved
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/servers/${encodeURIComponent(i.agentId)}${tab ? `?tab=${tab}` : ''}`}
                        className="font-medium text-ink hover:text-accent"
                      >
                        {i.server}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{TYPE_LABELS[i.type] ?? i.type}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink">{i.title}</div>
                      <div className="text-xs text-ink-muted">{i.detail}</div>
                      {!i.notified && (
                        <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-ink-soft" title="No notification channel was configured or the problem re-occurred within the cooldown">
                          <BellOff className="h-3 w-3" /> not notified
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-ink-muted" title={new Date(i.startedAt).toLocaleString()}>
                      {timeAgo(i.startedAt)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-ink-muted">
                      {formatDistanceStrict(new Date(i.startedAt), end)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
