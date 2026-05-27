'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Loader2,
  Pencil,
  Trash2,
  Cpu,
  HardDrive,
  Container,
  Settings,
  LayoutGrid,
  Maximize2,
  Check,
  Layers,
  Monitor,
} from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { RenameServerDialog } from '@/components/RenameServerDialog';
import { formatBytes, formatUptime, timeAgo } from '@/lib/utils';
import { CoreTab } from '@/components/CoreTab';
import { DiskTab } from '@/components/DiskTab';
import { ContainersTab } from '@/components/ContainersTab';
import { ServicesTab } from '@/components/ServicesTab';
import { GpuTab } from '@/components/GpuTab';

interface AgentDetail {
  agentId: string;
  hostname: string;
  label?: string;
  os: string;
  osVersion: string;
  kernel: string;
  arch: string;
  cpuModel: string;
  cpuCores: number;
  totalMemoryBytes: number;
  totalDiskBytes: number;
  publicIp?: string;
  privateIp?: string;
  tags: string[];
  online: boolean;
  lastSeenAt?: string;
  registeredAt: string;
  latest: {
    cpuPercent: number;
    memUsedBytes: number;
    memTotalBytes: number;
    swapUsedBytes: number;
    swapTotalBytes: number;
    diskUsedBytes: number;
    diskTotalBytes: number;
    diskReadBps: number;
    diskWriteBps: number;
    netRxBps: number;
    netTxBps: number;
    dockerCpuPercent: number;
    dockerMemUsedBytes: number;
    dockerNetRxBps: number;
    dockerNetTxBps: number;
    dockerContainerCount: number;
    temperatureC: number;
    gpuUtilPercent: number;
    gpuMemUsedBytes: number;
    gpuMemTotalBytes: number;
    gpuPowerWatts: number;
    uptimeSeconds: number;
    processCount: number;
    loadAvg1: number;
    loadAvg5: number;
    loadAvg15: number;
  } | null;
}

interface MetricPoint {
  ts: string;
  cpuPercent: number;
  memUsedBytes: number;
  memTotalBytes: number;
  swapUsedBytes: number;
  swapTotalBytes: number;
  diskUsedBytes: number;
  diskTotalBytes: number;
  diskReadBps: number;
  diskWriteBps: number;
  netRxBps: number;
  netTxBps: number;
  dockerCpuPercent: number;
  dockerMemUsedBytes: number;
  dockerNetRxBps: number;
  dockerNetTxBps: number;
  dockerContainerCount: number;
  temperatureC: number;
  temperatures: Record<string, number>; // multi-sensor map
  gpuUtilPercent: number;
  gpuMemUsedBytes: number;
  gpuMemTotalBytes: number;
  gpuPowerWatts: number;
  loadAvg1: number;
  loadAvg5: number;
  loadAvg15: number;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const RANGES = [
  { v: '1h', label: '1 hour' },
  { v: '6h', label: '6 hours' },
  { v: '24h', label: '24 hours' },
  { v: '7d', label: '7 days' },
];

export function ServerDetailClient({ agentId }: { agentId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [range, setRange] = useState('1h');
  const [activeTab, setActiveTab] = useState<'core' | 'disk' | 'gpu' | 'containers' | 'service'>('core');

  // Sync tab from search params
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'core' || tabParam === 'disk' || tabParam === 'gpu' || tabParam === 'containers' || tabParam === 'service') {
      setActiveTab(tabParam as any);
    }
  }, [searchParams]);
  const [isGridLayout, setIsGridLayout] = useState(true);
  const [layoutDropdownOpen, setLayoutDropdownOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [detailLayout, setDetailLayout] = useState<'default' | 'tabs'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('server_detail_layout') as 'default' | 'tabs') || 'tabs';
    }
    return 'tabs';
  });

  const changeDetailLayout = (layout: 'default' | 'tabs') => {
    setDetailLayout(layout);
    if (typeof window !== 'undefined') {
      localStorage.setItem('server_detail_layout', layout);
    }
  };

  const { data, isLoading, mutate } = useSWR<{ agent: AgentDetail }>(
    `/api/agents/${agentId}`,
    fetcher,
    { refreshInterval: 5000 }
  );
  const { data: metricsData } = useSWR<{ metrics: MetricPoint[] }>(
    `/api/agents/${agentId}/metrics?range=${range}`,
    fetcher,
    { refreshInterval: 10000 }
  );

  const agent = data?.agent;
  const metrics = metricsData?.metrics ?? [];

  const performDelete = async () => {
    const res = await fetch(`/api/agents/${agentId}`, { method: 'DELETE' });
    if (!res.ok) {
      toast.error('Failed to delete');
      throw new Error('delete failed');
    }
    toast.success('Server removed');
    router.push('/servers');
  };

  const saveRename = async (trimmed: string) => {
    const res = await fetch(`/api/agents/${agentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: trimmed }),
    });
    if (!res.ok) {
      toast.error('Failed to update');
      throw new Error('rename failed');
    }
    toast.success('Updated');
    mutate();
  };

  if (isLoading && !agent) {
    return (
      <div className="flex items-center justify-center py-24 text-ink-muted">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading server…
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="card card-pad text-center">
        <p className="text-ink-muted">Server not found.</p>
        <Link href="/servers" className="btn-secondary mt-4">
          Back to servers
        </Link>
      </div>
    );
  }

  const latest = agent.latest;
  const hasGpu = (latest?.gpuMemTotalBytes ?? 0) > 0;

  const tabs = [
    { id: 'core' as const, label: 'Core', icon: Cpu },
    { id: 'disk' as const, label: 'Disk', icon: HardDrive },
    ...(hasGpu ? [{ id: 'gpu' as const, label: 'GPU', icon: Monitor }] : []),
    { id: 'containers' as const, label: 'Containers', icon: Container },
    { id: 'service' as const, label: 'Service', icon: Layers },
  ];

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Link
          href="/servers"
          className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          All servers
        </Link>
      </div>

      {/* Header Info Banner */}
      <div className="card p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-ink">
              {agent.label || agent.hostname}
            </h1>
            <span
              className={`chip text-xs font-semibold px-2 py-0.5 rounded-full border border-current/10 ${
                agent.online ? 'chip-success' : 'chip-muted'
              }`}
            >
              {agent.online ? 'Online' : `Offline (${timeAgo(agent.lastSeenAt)})`}
            </span>
          </div>

          {/* Details Row */}
          <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-xs text-ink-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
              Up
            </span>
            <span className="text-border">•</span>
            <span className="flex items-center gap-1">
              <span className="text-ink-soft">IP:</span>
              <span className="font-mono text-ink">{agent.publicIp || '—'}</span>
            </span>
            <span className="text-border">•</span>
            <span className="flex items-center gap-1">
              <span className="text-ink-soft">Uptime:</span>
              <span className="text-ink">{formatUptime(latest?.uptimeSeconds ?? 0)}</span>
            </span>
            <span className="text-border">•</span>
            <span className="flex items-center gap-1">
              <span className="text-ink-soft">OS:</span>
              <span className="text-ink">
                {agent.os} {agent.osVersion}
              </span>
            </span>
            <span className="text-border">•</span>
            <span className="flex items-center gap-1">
              <span className="text-ink-soft">CPU:</span>
              <span className="text-ink">
                {agent.cpuModel || `${agent.arch} (${agent.cpuCores} cores)`}
              </span>
            </span>
            <span className="text-border">•</span>
            <span className="flex items-center gap-1">
              <span className="text-ink-soft">RAM:</span>
              <span className="text-ink">{formatBytes(agent.totalMemoryBytes)}</span>
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setRenameOpen(true)}
            className="p-2 rounded-lg border border-border text-ink-soft hover:text-ink hover:bg-bg-muted transition-colors"
            title="Edit label"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="btn-danger p-2"
            title="Delete VPS"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Tab Navigation and Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3">
        {/* Navigation Tabs */}
        {detailLayout === 'tabs' ? (
          <div className="flex p-1 bg-bg-card border border-border rounded-xl gap-1 max-w-max">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    isActive
                      ? 'bg-bg-muted text-ink shadow-sm'
                      : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="text-xs text-ink-soft font-semibold py-1.5">
            System Overview (All Metrics)
          </div>
        )}

        {/* Time range selector and width dropdown */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Time range selector */}
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="bg-bg-card border border-border text-xs text-ink font-semibold py-1.5 pl-3 pr-8 rounded-lg outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 cursor-pointer appearance-none"
            style={{
              backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 8px center',
              backgroundSize: '12px',
            }}
          >
            {RANGES.map((r) => (
              <option key={r.v} value={r.v}>
                {r.label}
              </option>
            ))}
          </select>

          {/* Width selection dropdown */}
          <div className="relative">
            <button
              onClick={() => setLayoutDropdownOpen(!layoutDropdownOpen)}
              className="p-2 rounded-lg bg-bg-card border border-border text-ink-soft hover:text-ink hover:bg-bg-muted transition-all"
              title="Display settings"
            >
              <Settings className="h-4 w-4" />
            </button>
            {layoutDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setLayoutDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-48 rounded-xl border border-border bg-bg-card p-1.5 shadow-2xl z-20">
                  <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-ink-soft">
                    Chart Width
                  </div>
                  <button
                    onClick={() => {
                      setIsGridLayout(true);
                      setLayoutDropdownOpen(false);
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-xs text-ink hover:bg-bg-muted transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <LayoutGrid className="h-3.5 w-3.5" />
                      Grid
                    </span>
                    {isGridLayout && <Check className="h-3.5 w-3.5 text-accent" />}
                  </button>
                  <button
                    onClick={() => {
                      setIsGridLayout(false);
                      setLayoutDropdownOpen(false);
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-xs text-ink hover:bg-bg-muted transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Maximize2 className="h-3.5 w-3.5" />
                      Full
                    </span>
                    {!isGridLayout && <Check className="h-3.5 w-3.5 text-accent" />}
                  </button>

                  <div className="border-t border-border my-1" />
                  <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-ink-soft">
                    Display Mode
                  </div>
                  <button
                    onClick={() => {
                      changeDetailLayout('default');
                      setLayoutDropdownOpen(false);
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-xs text-ink hover:bg-bg-muted transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Layers className="h-3.5 w-3.5" />
                      Default (All)
                    </span>
                    {detailLayout === 'default' && <Check className="h-3.5 w-3.5 text-accent" />}
                  </button>
                  <button
                    onClick={() => {
                      changeDetailLayout('tabs');
                      setLayoutDropdownOpen(false);
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-xs text-ink hover:bg-bg-muted transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Cpu className="h-3.5 w-3.5" />
                      Tabs
                    </span>
                    {detailLayout === 'tabs' && <Check className="h-3.5 w-3.5 text-accent" />}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tab Panels */}
      <div className="space-y-8">
        {detailLayout === 'tabs' ? (
          <>
            {activeTab === 'core' && (
              <CoreTab
                metrics={metrics}
                totalMemoryBytes={agent.totalMemoryBytes}
                isGridLayout={isGridLayout}
              />
            )}
            {activeTab === 'disk' && (
              <DiskTab
                metrics={metrics}
                totalDiskBytes={agent.totalDiskBytes}
                isGridLayout={isGridLayout}
              />
            )}
            {activeTab === 'containers' && (
              <ContainersTab
                agentId={agent.agentId}
                metrics={metrics}
                isGridLayout={isGridLayout}
                agentLabel={agent.label}
                agentHostname={agent.hostname}
              />
            )}
            {activeTab === 'gpu' && hasGpu && (
              <GpuTab metrics={metrics} isGridLayout={isGridLayout} />
            )}
            {activeTab === 'service' && (
              <ServicesTab
                agentId={agent.agentId}
                agentLabel={agent.label}
                agentHostname={agent.hostname}
              />
            )}
          </>
        ) : (
          <>
            {/* Core Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-1 text-sm font-bold text-ink tracking-tight">
                <Cpu className="h-4 w-4 text-accent" />
                <span>Core Metrics</span>
              </div>
              <CoreTab
                metrics={metrics}
                totalMemoryBytes={agent.totalMemoryBytes}
                isGridLayout={isGridLayout}
              />
            </div>

            <div className="border-t border-border my-6" />

            {/* Disk Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-1 text-sm font-bold text-ink tracking-tight">
                <HardDrive className="h-4 w-4 text-accent" />
                <span>Disk & Storage</span>
              </div>
              <DiskTab
                metrics={metrics}
                totalDiskBytes={agent.totalDiskBytes}
                isGridLayout={isGridLayout}
              />
            </div>

            <div className="border-t border-border my-6" />

            {/* GPU Section - only when GPU data present */}
            {hasGpu && (
              <>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 px-1 text-sm font-bold text-ink tracking-tight">
                    <Monitor className="h-4 w-4 text-accent" />
                    <span>GPU</span>
                  </div>
                  <GpuTab metrics={metrics} isGridLayout={isGridLayout} />
                </div>
                <div className="border-t border-border my-6" />
              </>
            )}

            {/* Containers Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-1 text-sm font-bold text-ink tracking-tight">
                <Container className="h-4 w-4 text-accent" />
                <span>Docker Containers</span>
              </div>
              <ContainersTab
                agentId={agent.agentId}
                metrics={metrics}
                isGridLayout={isGridLayout}
                agentLabel={agent.label}
                agentHostname={agent.hostname}
              />
            </div>

            <div className="border-t border-border my-6" />

            {/* Services Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-1 text-sm font-bold text-ink tracking-tight">
                <Layers className="h-4 w-4 text-accent" />
                <span>System Services</span>
              </div>
              <ServicesTab
                agentId={agent.agentId}
                agentLabel={agent.label}
                agentHostname={agent.hostname}
              />
            </div>
          </>
        )}
      </div>

      {/* Dialogs */}
      <RenameServerDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        label={agent.label}
        hostname={agent.hostname}
        onSave={saveRename}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete server?"
        description={
          <>
            Remove <span className="font-semibold text-ink">{agent.label || agent.hostname}</span> and
            all metrics. <span className="text-danger">This cannot be undone.</span>
          </>
        }
        cancelLabel="Cancel"
        confirmLabel="Delete"
        tone="danger"
        onConfirm={performDelete}
      />
    </div>
  );
}
