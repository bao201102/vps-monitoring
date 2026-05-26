'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { useState, useMemo, useEffect } from 'react';
import { PlusCircle, RefreshCw, Loader2 } from 'lucide-react';
import { ServerToolbar } from '@/components/servers/ServerToolbar';
import { ServerTableView, ServerListItem } from '@/components/servers/ServerTableView';
import { ServerGridView } from '@/components/servers/ServerGridView';
import { VisibleFieldsState } from '@/components/servers/ViewConfigPopover';
import { percent } from '@/lib/utils';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function ServersClient() {
  const { data, isLoading, mutate, isValidating } = useSWR<{ agents: ServerListItem[] }>(
    '/api/agents',
    fetcher,
    { refreshInterval: 5000 }
  );

  const [q, setQ] = useState('');
  const [layout, setLayout] = useState<'table' | 'grid'>('table');
  const [statusFilter, setStatusFilter] = useState<'all' | 'up' | 'down' | 'paused'>('all');
  const [sortBy, setSortBy] = useState<string>('host');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const [visibleFields, setVisibleFields] = useState<VisibleFieldsState>({
    cpu: true,
    memory: true,
    disk: true,
    gpu: true,
    loadAvg: true,
    net: true,
    temp: true,
    bat: true, // Selected by default
    services: true,
    uptime: true,
    actions: true,
  });

  // Load configuration from localStorage on mount (SSR safe)
  useEffect(() => {
    const savedLayout = localStorage.getItem('vps_layout');
    if (savedLayout === 'table' || savedLayout === 'grid') {
      setLayout(savedLayout);
    }
    const savedVisibleFields = localStorage.getItem('vps_visible_fields');
    if (savedVisibleFields) {
      try {
        const parsed = JSON.parse(savedVisibleFields);
        setVisibleFields((prev) => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error('Failed to parse visible fields from localStorage:', e);
      }
    }
  }, []);

  const handleLayoutChange = (newLayout: 'table' | 'grid') => {
    setLayout(newLayout);
    localStorage.setItem('vps_layout', newLayout);
  };

  const toggleField = (field: keyof VisibleFieldsState) => {
    setVisibleFields((prev) => {
      const next = {
        ...prev,
        [field]: !prev[field],
      };
      localStorage.setItem('vps_visible_fields', JSON.stringify(next));
      return next;
    });
  };

  const rawAgents = useMemo(() => data?.agents ?? [], [data]);

  // Calculate status counts on all fetched agents before filtering
  const counts = useMemo(() => {
    let up = 0;
    let down = 0;
    let paused = 0;

    rawAgents.forEach((a) => {
      // If hostname or label has "paused" tag, we can simulate paused
      const isPaused = a.hostname.toLowerCase().includes('paused') || a.label?.toLowerCase().includes('paused');
      if (isPaused) {
        paused++;
      } else if (a.online) {
        up++;
      } else {
        down++;
      }
    });

    return {
      all: rawAgents.length,
      up,
      down,
      paused,
    };
  }, [rawAgents]);

  // Filter and sort agents in memory
  const processedServers = useMemo(() => {
    return rawAgents
      .filter((a) => {
        // Status Filter
        const isPaused = a.hostname.toLowerCase().includes('paused') || a.label?.toLowerCase().includes('paused');
        if (statusFilter === 'up' && (!a.online || isPaused)) return false;
        if (statusFilter === 'down' && (a.online || isPaused)) return false;
        if (statusFilter === 'paused' && !isPaused) return false;

        // Search Query
        if (!q) return true;
        const s = q.toLowerCase();
        return (
          a.hostname.toLowerCase().includes(s) ||
          a.label?.toLowerCase().includes(s) ||
          a.os.toLowerCase().includes(s) ||
          a.publicIp?.toLowerCase().includes(s) ||
          a.agentId.toLowerCase().includes(s)
        );
      })
      .sort((a, b) => {
        let valA: any = 0;
        let valB: any = 0;

        switch (sortBy) {
          case 'host':
            valA = a.label || a.hostname;
            valB = b.label || b.hostname;
            break;
          case 'cpu':
            valA = a.latest?.cpuPercent ?? 0;
            valB = b.latest?.cpuPercent ?? 0;
            break;
          case 'memory':
            valA = percent(a.latest?.memUsedBytes ?? 0, a.latest?.memTotalBytes ?? a.totalMemoryBytes);
            valB = percent(b.latest?.memUsedBytes ?? 0, b.latest?.memTotalBytes ?? b.totalMemoryBytes);
            break;
          case 'disk':
            valA = percent(a.latest?.diskUsedBytes ?? 0, a.latest?.diskTotalBytes ?? a.totalDiskBytes);
            valB = percent(b.latest?.diskUsedBytes ?? 0, b.latest?.diskTotalBytes ?? b.totalDiskBytes);
            break;
          case 'gpu':
            valA = a.latest?.gpuUtilPercent ?? 0;
            valB = b.latest?.gpuUtilPercent ?? 0;
            break;
          case 'loadAvg':
            valA = a.latest?.loadAvg1 ?? 0;
            valB = b.latest?.loadAvg1 ?? 0;
            break;
          case 'net':
            valA = (a.latest?.netRxBps ?? 0) + (a.latest?.netTxBps ?? 0);
            valB = (b.latest?.netRxBps ?? 0) + (b.latest?.netTxBps ?? 0);
            break;
          case 'temp':
            valA = a.latest?.temperatureC ?? 0;
            valB = b.latest?.temperatureC ?? 0;
            break;
          case 'bat':
            valA = 0;
            valB = 0;
            break;
          case 'services':
            valA = a.latest?.dockerContainerCount ?? 0;
            valB = b.latest?.dockerContainerCount ?? 0;
            break;
          case 'uptime':
            valA = a.latest?.uptimeSeconds ?? 0;
            valB = b.latest?.uptimeSeconds ?? 0;
            break;

          default:
            valA = a.hostname;
            valB = b.hostname;
        }

        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else {
          return sortOrder === 'asc' ? valA - valB : valB - valA;
        }
      });
  }, [rawAgents, q, statusFilter, sortBy, sortOrder]);

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Servers</h1>
          <p className="mt-1 text-sm text-ink-muted">All VPS connected to this dashboard.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => mutate()} className="btn-secondary" title="Refresh" disabled={isValidating}>
            <RefreshCw className={`h-4 w-4 ${isValidating ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link href="/servers/add" className="btn-primary">
            <PlusCircle className="h-4 w-4" />
            Add server
          </Link>
        </div>
      </div>

      {/* Main Content Box */}
      <div className="card relative">
        {/* Toolbar controls */}
        <ServerToolbar
          searchQuery={q}
          setSearchQuery={setQ}
          layout={layout}
          setLayout={handleLayoutChange}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          sortBy={sortBy}
          setSortBy={setSortBy}
          sortOrder={sortOrder}
          setSortOrder={setSortOrder}
          visibleFields={visibleFields}
          toggleField={toggleField}
          counts={counts}
        />

        {/* List Content wrapped to clip bottom corners safely */}
        <div className="rounded-b-2xl overflow-hidden">
          {isLoading ? (
            <div className="space-y-2 p-5">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-14 w-full" />
              ))}
            </div>
          ) : processedServers.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-sm text-ink-muted">No servers match this query.</p>
            </div>
          ) : (
            <div className="p-4 sm:p-5">
              {layout === 'table' ? (
                <ServerTableView
                  servers={processedServers}
                  sortBy={sortBy}
                  setSortBy={setSortBy}
                  sortOrder={sortOrder}
                  setSortOrder={setSortOrder}
                  visibleFields={visibleFields}
                  onRefresh={mutate}
                />
              ) : (
                <ServerGridView
                  servers={processedServers}
                  visibleFields={visibleFields}
                  onRefresh={mutate}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

