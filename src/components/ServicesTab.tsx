'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  Layers,
  Activity,
  Cpu,
  Database,
  Clock,
  Loader2,
} from 'lucide-react';
import useSWR from 'swr';
import { formatBytes, cn } from '@/lib/utils';

export interface ServiceData {
  name: string;
  description: string;
  state: 'Active' | 'Inactive' | 'Failed';
  subState: 'Running' | 'Exited' | 'Dead' | 'Failed';
  cpu10m: number | null; // percentage, null for N/A
  cpuPeak: number | null; // percentage, null for N/A
  memory: number | null; // bytes, null for N/A
  memoryPeak: number | null; // bytes, null for N/A
  updated: string;
}

interface ServicesTabProps {
  agentId: string;
  agentLabel?: string;
  agentHostname?: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function ServicesTab({ agentId, agentLabel, agentHostname }: ServicesTabProps) {
  const { data, isLoading } = useSWR<{ services: ServiceData[] }>(
    `/api/agents/${agentId}/services`,
    fetcher,
    { refreshInterval: 5000 }
  );

  const services = data?.services || [];
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<keyof ServiceData>('name');
  const [sortAsc, setSortAsc] = useState(true);

  const handleSort = (field: keyof ServiceData) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const filteredServices = useMemo(() => {
    return services
      .filter((s) => {
        const query = searchQuery.toLowerCase();
        return (
          s.name.toLowerCase().includes(query) ||
          s.description.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];

        if (valA === null && valB !== null) return 1;
        if (valB === null && valA !== null) return -1;
        if (valA === null && valB === null) return 0;

        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else if (typeof valA === 'number' && typeof valB === 'number') {
          return sortAsc ? valA - valB : valB - valA;
        }
        return 0;
      });
  }, [services, searchQuery, sortField, sortAsc]);

  const renderSortIndicator = (field: keyof ServiceData) => {
    if (sortField !== field) {
      return <span className="ml-1 text-ink-soft opacity-40 select-none">↑↓</span>;
    }
    return <span className="ml-1 font-bold text-[#3b82f6] select-none">{sortAsc ? '↑' : '↓'}</span>;
  };

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-24 text-ink-muted card">
        <Loader2 className="mr-2 h-4 w-4 animate-spin text-brand" />
        Loading services…
      </div>
    );
  }

  // Dynamically calculate metrics
  const totalCount = services.length;
  const failedCount = services.filter(s => s.state === 'Failed' || s.subState === 'Failed').length;

  return (
    <div className="card overflow-hidden">
      {/* Table Header Section matching screenshot layout */}
      <div className="flex flex-col gap-3 border-b border-border bg-bg-soft/30 px-5 py-4 sm:flex-row sm:items-center sm:justify-between rounded-t-2xl">
        <div className="space-y-0.5">
          <h2 className="text-lg font-bold tracking-tight text-ink">Systemd Services</h2>
          <div className="text-xs text-ink-muted flex items-center gap-1.5">
            <span>Total: {totalCount}</span>
            <span className="text-border">|</span>
            <span className="text-danger font-semibold">Failed: {failedCount}</span>
            <span className="text-border">|</span>
            <span>Updated every 10 minutes.</span>
          </div>
        </div>
        <div className="relative max-w-sm shrink-0">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-ink-soft">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            placeholder="Search by name, description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-9 py-1.5 bg-bg-muted/30 border border-border rounded-lg text-xs"
          />
        </div>
      </div>

      {/* Services Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-border text-ink-soft font-semibold select-none bg-bg-muted/40">
              <th className="py-3 px-4 cursor-pointer hover:text-ink transition-colors" onClick={() => handleSort('name')}>
                <span className="flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-ink-soft" />
                  Name{renderSortIndicator('name')}
                </span>
              </th>
              <th className="py-3 px-4 cursor-pointer hover:text-ink transition-colors" onClick={() => handleSort('state')}>
                <span className="flex items-center gap-1.5">
                  <Activity className="h-4 w-4 text-ink-soft" />
                  State{renderSortIndicator('state')}
                </span>
              </th>
              <th className="py-3 px-4 cursor-pointer hover:text-ink transition-colors" onClick={() => handleSort('subState')}>
                <span className="flex items-center gap-1.5">
                  <Activity className="h-4 w-4 text-ink-soft" />
                  Sub State{renderSortIndicator('subState')}
                </span>
              </th>
              <th className="py-3 px-4 cursor-pointer hover:text-ink transition-colors text-right" onClick={() => handleSort('cpu10m')}>
                <span className="flex items-center gap-1.5 justify-end">
                  <Cpu className="h-4 w-4 text-ink-soft" />
                  CPU (10m){renderSortIndicator('cpu10m')}
                </span>
              </th>
              <th className="py-3 px-4 cursor-pointer hover:text-ink transition-colors text-right" onClick={() => handleSort('cpuPeak')}>
                <span className="flex items-center gap-1.5 justify-end">
                  <Cpu className="h-4 w-4 text-ink-soft" />
                  CPU Peak{renderSortIndicator('cpuPeak')}
                </span>
              </th>
              <th className="py-3 px-4 cursor-pointer hover:text-ink transition-colors text-right" onClick={() => handleSort('memory')}>
                <span className="flex items-center gap-1.5 justify-end">
                  <Database className="h-4 w-4 text-ink-soft" />
                  Memory{renderSortIndicator('memory')}
                </span>
              </th>
              <th className="py-3 px-4 cursor-pointer hover:text-ink transition-colors text-right" onClick={() => handleSort('memoryPeak')}>
                <span className="flex items-center gap-1.5 justify-end">
                  <Database className="h-4 w-4 text-ink-soft" />
                  Memory Peak{renderSortIndicator('memoryPeak')}
                </span>
              </th>
              <th className="py-3 px-4 cursor-pointer hover:text-ink transition-colors" onClick={() => handleSort('updated')}>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-ink-soft" />
                  Updated{renderSortIndicator('updated')}
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-ink">
            {filteredServices.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-ink-soft">
                  No services found
                </td>
              </tr>
            ) : (
              filteredServices.map((service, idx) => {
                return (
                  <tr
                    key={service.name + idx}
                    className="hover:bg-bg-soft/50 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-semibold text-ink font-mono">
                      {service.name}
                    </td>
                    
                    {/* State Column */}
                    <td className="py-3.5 px-4">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border",
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
                              ? 'bg-success'
                              : service.state === 'Failed'
                                ? 'bg-danger'
                                : 'bg-ink-soft'
                          )}
                        />
                        {service.state}
                      </span>
                    </td>

                    {/* Sub State Column */}
                    <td className="py-3.5 px-4">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                          service.subState === 'Running'
                            ? 'chip-success border-success/20'
                            : service.subState === 'Failed'
                              ? 'chip-danger border-danger/20'
                              : 'chip-muted border-border'
                        )}
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            service.subState === 'Running'
                              ? 'bg-success'
                              : service.subState === 'Failed'
                                ? 'bg-danger'
                                : 'bg-ink-soft'
                          )}
                        />
                        {service.subState}
                      </span>
                    </td>

                    {/* CPU (10m) */}
                    <td className="py-3.5 px-4 text-right font-medium text-ink-soft">
                      {service.cpu10m !== null ? `${service.cpu10m.toFixed(2)}%` : 'N/A'}
                    </td>

                    {/* CPU Peak */}
                    <td className="py-3.5 px-4 text-right font-medium text-ink-soft">
                      {service.cpuPeak !== null ? `${service.cpuPeak.toFixed(2)}%` : 'N/A'}
                    </td>

                    {/* Memory */}
                    <td className="py-3.5 px-4 text-right font-medium text-ink-soft">
                      {service.memory !== null ? formatBytes(service.memory) : 'N/A'}
                    </td>

                    {/* Memory Peak */}
                    <td className="py-3.5 px-4 text-right font-medium text-ink-soft">
                      {service.memoryPeak !== null ? formatBytes(service.memoryPeak) : 'N/A'}
                    </td>

                    {/* Updated */}
                    <td className="py-3.5 px-4 text-ink-soft font-mono">
                      {service.updated}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
