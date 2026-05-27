'use client';

import useSWR from 'swr';
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Play,
  Square,
  RotateCw,
  Cpu,
  Database,
  Hash,
  Clock,
  ExternalLink,
  Layers,
  FileText,
  Shield,
  Loader2,
} from 'lucide-react';
import { ServiceData } from './ServicesTab';
import { formatBytes, timeAgo, cn } from '@/lib/utils';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import { toast } from 'sonner';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface ServiceDetailPanelProps {
  agentId: string;
  service: ServiceData;
  onClose: () => void;
  mutateServices: () => void;
}

const chartTooltipStyle = {
  backgroundColor: 'rgb(var(--chart-tooltip-bg))',
  borderColor: 'rgb(var(--chart-tooltip-border))',
  borderRadius: '12px',
  color: 'rgb(var(--chart-tooltip-fg))',
  fontSize: '12px',
};

const chartGridStroke = 'rgb(var(--chart-grid))';
const chartAxisStroke = 'rgb(var(--chart-axis))';

const HISTORICAL_RANGES = [
  { v: '1h', label: '1H' },
  { v: '6h', label: '6H' },
  { v: '24h', label: '24H' },
  { v: '7d', label: '7D' },
];

export function ServiceDetailPanel({
  agentId,
  service,
  onClose,
  mutateServices,
}: ServiceDetailPanelProps) {
  const [mounted, setMounted] = useState(false);
  const [range, setRange] = useState('1h');
  const [actionPending, setActionPending] = useState<string | null>(null);

  // Sync scroll lock
  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const { data: metricsData, isLoading: metricsLoading } = useSWR<{
    metrics: { ts: string; cpuPercent: number; memBytes: number }[];
  }>(
    `/api/agents/${agentId}/services/${encodeURIComponent(service.name)}/metrics?range=${range}`,
    fetcher,
    { refreshInterval: 10000 }
  );

  const metrics = metricsData?.metrics ?? [];

  const formatTime = (ts: string) => {
    try {
      return format(new Date(ts), range === '7d' || range === '24h' ? 'MM/dd HH:mm' : 'HH:mm');
    } catch {
      return ts;
    }
  };

  const formatTooltipLabel = (label: string) => {
    try {
      return format(new Date(label), 'MMM d, yyyy h:mm:ss a');
    } catch {
      return label;
    }
  };

  // Perform Service Actions (Start, Stop, Restart)
  const handleServiceAction = async (action: 'start' | 'stop' | 'restart') => {
    if (actionPending) return;
    setActionPending(action);
    
    const actionLabel = action === 'start' ? 'Starting' : action === 'stop' ? 'Stopping' : 'Restarting';
    const toastId = toast.loading(`${actionLabel} ${service.name}...`);

    try {
      const res = await fetch(`/api/agents/${agentId}/services`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceName: service.name,
          action,
        }),
      });

      if (!res.ok) {
        throw new Error('API error');
      }

      const data = await res.json();
      if (data.status === 'done') {
        toast.success(`Successfully executed ${action} for ${service.name}`, { id: toastId });
      } else if (data.status === 'failed') {
        toast.error(data.error || `Failed to ${action} ${service.name}`, { id: toastId });
      } else {
        toast.success(`Command sent: ${actionLabel} in background`, { id: toastId });
      }

      // Mutate services table to update status
      mutateServices();
    } catch (err) {
      console.error(err);
      toast.error(`Failed to execute ${action} on service.`, { id: toastId });
    } finally {
      setActionPending(null);
    }
  };

  const formatActiveEnter = (ts: string | null | undefined) => {
    if (!ts) return '—';
    try {
      const date = new Date(ts);
      return `${format(date, 'yyyy-MM-dd HH:mm:ss')} (${timeAgo(date)})`;
    } catch {
      return ts;
    }
  };

  if (!mounted) return null;

  return createPortal(
    <>
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm animate-fade-in cursor-pointer"
        onClick={onClose}
      />

      {/* Slide-over Drawer Panel */}
      <div className="fixed inset-y-0 right-0 z-[110] w-full max-w-xl bg-bg-soft border-l border-border shadow-2xl flex flex-col animate-slide-in-right h-full overflow-hidden">
        
        {/* Header Panel */}
        <div className="p-5 border-b border-border flex justify-between items-start gap-4 shrink-0 bg-bg-card/45 backdrop-blur-md">
          <div className="space-y-1.5 flex-grow min-w-0">
            <h2 className="text-lg font-bold tracking-tight text-ink truncate font-mono" title={service.name}>
              {service.name}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                  service.state === 'Active'
                    ? 'chip-success border-success/20'
                    : service.state === 'Failed'
                      ? 'chip-danger border-danger/20'
                      : 'chip-muted border-border'
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    service.state === 'Active'
                      ? 'bg-success animate-pulse'
                      : service.state === 'Failed'
                        ? 'bg-danger animate-ping'
                        : 'bg-ink-soft'
                  )}
                />
                {service.state}
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                  service.subState === 'Running'
                    ? 'chip-success border-success/20'
                    : service.subState === 'Failed'
                      ? 'chip-danger border-danger/20'
                      : 'chip-muted border-border'
                )}
              >
                {service.subState}
              </span>
            </div>
            {service.description && (
              <p className="text-xs text-ink-muted line-clamp-2 italic pr-4">
                {service.description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border border-border text-ink-soft hover:text-ink hover:bg-bg-muted transition-colors cursor-pointer"
            title="Close details"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 flex-grow overflow-y-auto space-y-6">

          {/* Action Toolbar */}
          <div className="card p-4 bg-bg-card/40 flex flex-col gap-3">
            <h3 className="text-[10px] font-bold text-ink-soft uppercase tracking-wider">Service Control</h3>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleServiceAction('start')}
                disabled={actionPending !== null || (service.state === 'Active' && service.subState === 'Running')}
                className={cn(
                  "inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold border transition-all cursor-pointer",
                  service.state === 'Active' && service.subState === 'Running'
                    ? 'bg-success/5 border-success/10 text-success/40 cursor-not-allowed'
                    : 'bg-success/15 hover:bg-success/25 border-success/30 text-success'
                )}
              >
                {actionPending === 'start' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                Start
              </button>

              <button
                onClick={() => handleServiceAction('stop')}
                disabled={actionPending !== null || service.subState !== 'Running'}
                className={cn(
                  "inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold border transition-all cursor-pointer",
                  service.subState !== 'Running'
                    ? 'bg-danger/5 border-danger/10 text-danger/40 cursor-not-allowed'
                    : 'bg-danger/15 hover:bg-danger/25 border-danger/30 text-danger'
                )}
              >
                {actionPending === 'stop' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Square className="h-3.5 w-3.5" />
                )}
                Stop
              </button>

              <button
                onClick={() => handleServiceAction('restart')}
                disabled={actionPending !== null || service.state !== 'Active'}
                className={cn(
                  "inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold border transition-all cursor-pointer",
                  service.state !== 'Active'
                    ? 'bg-accent/5 border-accent/10 text-accent/40 cursor-not-allowed'
                    : 'bg-accent/15 hover:bg-accent/25 border-accent/30 text-accent'
                )}
              >
                {actionPending === 'restart' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCw className="h-3.5 w-3.5" />
                )}
                Restart
              </button>
            </div>
          </div>

          {/* Metrics History Section */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5 text-xs font-bold text-ink uppercase tracking-wider">
                <Cpu className="h-3.5 w-3.5 text-accent" />
                <span>Performance History</span>
              </div>
              
              {/* Range Selector */}
              <div className="flex bg-bg-card border border-border rounded-lg p-0.5 gap-0.5">
                {HISTORICAL_RANGES.map((r) => (
                  <button
                    key={r.v}
                    onClick={() => setRange(r.v)}
                    className={cn(
                      "px-2 py-0.5 text-[10px] font-semibold rounded-md transition-all",
                      range === r.v ? 'bg-bg-muted text-ink shadow-sm' : 'text-ink-soft hover:text-ink'
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {metricsLoading ? (
              <div className="flex py-16 items-center justify-center text-ink-soft card">
                <Loader2 className="h-5 w-5 animate-spin text-accent" />
              </div>
            ) : metrics.length === 0 ? (
              <div className="card p-6 text-center text-ink-soft text-xs italic bg-bg-card/20">
                No metric history recorded for this service.
                <p className="mt-1 text-[10px] text-ink-soft/70">Metrics are logged while the service is running.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* CPU Chart */}
                <div className="card p-4">
                  <div className="mb-2 flex justify-between items-center text-xs">
                    <span className="font-semibold text-ink-soft">CPU Utilization</span>
                    <span className="font-bold text-ink">{service.cpu10m !== null ? `${service.cpu10m.toFixed(1)}%` : '—'}</span>
                  </div>
                  <div className="h-[140px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={metrics} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                        <defs>
                          <linearGradient id="serviceCpuGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke={chartGridStroke} strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="ts" tickFormatter={formatTime} stroke={chartAxisStroke} fontSize={9} tickLine={false} axisLine={false} />
                        <YAxis stroke={chartAxisStroke} fontSize={9} tickLine={false} axisLine={false} tickFormatter={(v) => `${v.toFixed(0)}%`} domain={[0, 'auto']} />
                        <Tooltip labelFormatter={formatTooltipLabel} contentStyle={chartTooltipStyle} formatter={(v: number) => [`${v.toFixed(2)}%`, 'CPU']} />
                        <Area type="monotone" dataKey="cpuPercent" stroke="#6366f1" strokeWidth={1.5} fillOpacity={1} fill="url(#serviceCpuGrad)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Memory Chart */}
                <div className="card p-4">
                  <div className="mb-2 flex justify-between items-center text-xs">
                    <span className="font-semibold text-ink-soft">Memory Footprint</span>
                    <span className="font-bold text-ink">{service.memory !== null ? formatBytes(service.memory) : '—'}</span>
                  </div>
                  <div className="h-[140px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={metrics} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="serviceMemGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke={chartGridStroke} strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="ts" tickFormatter={formatTime} stroke={chartAxisStroke} fontSize={9} tickLine={false} axisLine={false} />
                        <YAxis stroke={chartAxisStroke} fontSize={9} tickLine={false} axisLine={false} tickFormatter={(v) => formatBytes(v, 0)} domain={[0, 'auto']} />
                        <Tooltip labelFormatter={formatTooltipLabel} contentStyle={chartTooltipStyle} formatter={(v: number) => [formatBytes(v), 'Memory']} />
                        <Area type="monotone" dataKey="memBytes" stroke="#10b981" strokeWidth={1.5} fillOpacity={1} fill="url(#serviceMemGrad)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Properties Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-accent" />
              <span>Service Properties</span>
            </h3>
            
            <div className="card divide-y divide-border overflow-hidden text-xs">
              {/* Main PID */}
              <div className="flex py-3 px-4 justify-between items-center">
                <span className="text-ink-soft flex items-center gap-1.5">
                  <Hash className="h-3.5 w-3.5" />
                  Main PID
                </span>
                <span className="font-mono font-semibold text-ink">{service.mainPid ?? '—'}</span>
              </div>

              {/* Restarts */}
              <div className="flex py-3 px-4 justify-between items-center">
                <span className="text-ink-soft flex items-center gap-1.5">
                  <RotateCw className="h-3.5 w-3.5" />
                  Restarts
                </span>
                <span className="font-mono font-semibold text-ink">{service.nRestarts ?? '—'}</span>
              </div>

              {/* Tasks / Threads */}
              <div className="flex py-3 px-4 justify-between items-center">
                <span className="text-ink-soft flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5" />
                  Tasks (Threads)
                </span>
                <span className="font-mono font-semibold text-ink">
                  {service.tasksCurrent !== null && service.tasksCurrent !== undefined
                    ? `${service.tasksCurrent} / ${service.tasksMax && service.tasksMax > 0 && service.tasksMax < 9999999 ? service.tasksMax : '∞'}`
                    : '—'}
                </span>
              </div>

              {/* Load State */}
              <div className="flex py-3 px-4 justify-between items-center">
                <span className="text-ink-soft flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5" />
                  Load State
                </span>
                <span className="font-semibold text-ink capitalize">{service.loadState ?? '—'}</span>
              </div>

              {/* Unit File State */}
              <div className="flex py-3 px-4 justify-between items-center">
                <span className="text-ink-soft flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  Unit File State
                </span>
                <span className="font-semibold text-ink font-mono">{service.unitFileState ?? '—'}</span>
              </div>

              {/* Active Enter Timestamp */}
              <div className="flex py-3 px-4 justify-between items-center">
                <span className="text-ink-soft flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Active Since
                </span>
                <span className="font-medium text-ink text-right">
                  {formatActiveEnter(service.activeEnterTimestamp)}
                </span>
              </div>

              {/* Fragment File Path */}
              {service.fragmentPath && (
                <div className="flex flex-col py-3 px-4 gap-1">
                  <span className="text-ink-soft flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" />
                    Unit Path
                  </span>
                  <span className="font-mono text-[10px] text-ink bg-bg-muted/40 p-1.5 rounded border border-border select-all break-all leading-relaxed">
                    {service.fragmentPath}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Service Dependencies */}
          {service.requires && service.requires.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-ink uppercase tracking-wider">Requires / Dependencies</h3>
              <div className="flex flex-wrap gap-1.5">
                {service.requires.map((req, i) => (
                  <span
                    key={i}
                    className="font-mono text-[10px] text-ink-soft bg-bg-muted border border-border px-2 py-0.5 rounded"
                  >
                    {req}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Service Documentation */}
          {service.documentation && service.documentation.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-ink uppercase tracking-wider">Documentation</h3>
              <div className="space-y-1">
                {service.documentation.map((doc, i) => {
                  const isLink = doc.startsWith('http://') || doc.startsWith('https://');
                  return (
                    <div key={i} className="flex items-center text-xs">
                      {isLink ? (
                        <a
                          href={doc}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent hover:text-accent-hover font-semibold underline flex items-center gap-1 inline-flex max-w-full truncate"
                        >
                          <ExternalLink className="h-3 w-3 shrink-0" />
                          <span className="truncate">{doc}</span>
                        </a>
                      ) : (
                        <span className="text-ink-soft font-mono truncate">{doc}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>
    </>,
    document.body
  );
}
