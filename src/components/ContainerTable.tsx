'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  Container,
  Server,
  Cpu,
  Database,
  Activity,
  HeartPulse,
  Plug,
  Layers,
  CircleDot,
  Clock,
} from 'lucide-react';
import { formatBytes, formatBps, cn } from '@/lib/utils';
import { format } from 'date-fns';

export interface ContainerData {
  name: string;
  system?: string;
  agentId?: string;
  cpu: number; // percentage
  memory: number; // bytes
  net: number; // bps
  health: 'Healthy' | 'Unhealthy' | 'None';
  ports: string;
  image: string;
  status: string;
  updated: string;
  cpuWeight?: number;
  memWeight?: number;
  netWeight?: number;
  color?: string;
}

const formatUpdatedTime = (updatedStr: string) => {
  if (!updatedStr) return '—';
  try {
    const d = new Date(updatedStr);
    if (!isNaN(d.getTime())) {
      if (updatedStr.includes('-') || updatedStr.includes('/') || updatedStr.includes('T')) {
        return format(d, 'h:mm:ss a');
      }
    }
  } catch (e) {}
  return updatedStr;
};

interface ContainerTableProps {
  containers: ContainerData[];
  showSystem?: boolean;
  selectedContainer?: ContainerData | null;
  onSelectContainer?: (container: ContainerData | null) => void;
}

export function ContainerTable({
  containers,
  showSystem = false,
  selectedContainer,
  onSelectContainer,
}: ContainerTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<keyof ContainerData>('name');
  const [sortAsc, setSortAsc] = useState(true);

  const handleSort = (field: keyof ContainerData) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const filteredContainers = useMemo(() => {
    return containers
      .filter((c) => {
        const query = searchQuery.toLowerCase();
        return (
          c.name.toLowerCase().includes(query) ||
          c.image.toLowerCase().includes(query) ||
          c.ports.toLowerCase().includes(query) ||
          (showSystem && c.system && c.system.toLowerCase().includes(query))
        );
      })
      .sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];

        // Handle case where system might be undefined for some items
        if (sortField === 'system') {
          valA = (a.system || '').toLowerCase();
          valB = (b.system || '').toLowerCase();
        }

        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else if (typeof valA === 'number' && typeof valB === 'number') {
          return sortAsc ? valA - valB : valB - valA;
        }
        return 0;
      });
  }, [containers, searchQuery, sortField, sortAsc, showSystem]);

  const renderSortIndicator = (field: keyof ContainerData) => {
    if (sortField !== field) return null;
    return sortAsc ? ' ↑' : ' ↓';
  };

  return (
    <div className="card overflow-hidden">
      {/* Table Header Section */}
      <div className="flex flex-col gap-3 border-b border-border bg-bg-soft/30 px-5 py-4 sm:flex-row sm:items-center sm:justify-between rounded-t-2xl">
        <div className="relative max-w-sm flex-1">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-ink-soft">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            placeholder="Search by name, image, ports..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-9 py-1.5"
          />
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-border text-ink-soft font-semibold select-none bg-bg-muted/40">
              <th className="py-3 px-4 cursor-pointer hover:text-ink transition-colors" onClick={() => handleSort('name')}>
                <span className="flex items-center gap-1.5">
                  <Container className="h-4 w-4 text-ink-soft" />
                  Name{renderSortIndicator('name')}
                </span>
              </th>
              {showSystem && (
                <th className="py-3 px-4 cursor-pointer hover:text-ink transition-colors" onClick={() => handleSort('system')}>
                  <span className="flex items-center gap-1.5">
                    <Server className="h-4 w-4 text-ink-soft" />
                    System{renderSortIndicator('system')}
                  </span>
                </th>
              )}
              <th className="py-3 px-4 text-right cursor-pointer hover:text-ink transition-colors" onClick={() => handleSort('cpu')}>
                <span className="flex items-center gap-1.5 justify-end">
                  <Cpu className="h-4 w-4 text-ink-soft" />
                  CPU{renderSortIndicator('cpu')}
                </span>
              </th>
              <th className="py-3 px-4 text-right cursor-pointer hover:text-ink transition-colors" onClick={() => handleSort('memory')}>
                <span className="flex items-center gap-1.5 justify-end">
                  <Database className="h-4 w-4 text-ink-soft" />
                  Memory{renderSortIndicator('memory')}
                </span>
              </th>
              <th className="py-3 px-4 text-right cursor-pointer hover:text-ink transition-colors" onClick={() => handleSort('net')}>
                <span className="flex items-center gap-1.5 justify-end">
                  <Activity className="h-4 w-4 text-ink-soft" />
                  Net{renderSortIndicator('net')}
                </span>
              </th>
              <th className="py-3 px-4 cursor-pointer hover:text-ink transition-colors" onClick={() => handleSort('health')}>
                <span className="flex items-center gap-1.5">
                  <HeartPulse className="h-4 w-4 text-ink-soft" />
                  Health{renderSortIndicator('health')}
                </span>
              </th>
              <th className="py-3 px-4 cursor-pointer hover:text-ink transition-colors" onClick={() => handleSort('ports')}>
                <span className="flex items-center gap-1.5">
                  <Plug className="h-4 w-4 text-ink-soft" />
                  Ports{renderSortIndicator('ports')}
                </span>
              </th>
              <th className="py-3 px-4 cursor-pointer hover:text-ink transition-colors" onClick={() => handleSort('image')}>
                <span className="flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-ink-soft" />
                  Image{renderSortIndicator('image')}
                </span>
              </th>
              <th className="py-3 px-4 cursor-pointer hover:text-ink transition-colors" onClick={() => handleSort('status')}>
                <span className="flex items-center gap-1.5">
                  <CircleDot className="h-4 w-4 text-ink-soft" />
                  Status{renderSortIndicator('status')}
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
            {filteredContainers.length === 0 ? (
              <tr>
                <td colSpan={showSystem ? 10 : 9} className="py-8 text-center text-ink-soft">
                  No containers found
                </td>
              </tr>
            ) : (
              filteredContainers.map((container, idx) => {
                const isSelected = selectedContainer &&
                  selectedContainer.name === container.name &&
                  selectedContainer.system === container.system;
                return (
                  <tr
                    key={container.name + idx}
                    className={cn(
                      "hover:bg-bg-soft/50 transition-colors cursor-pointer group",
                      isSelected ? "bg-bg-muted/80 text-ink" : ""
                    )}
                    onClick={() => {
                      if (isSelected) {
                        onSelectContainer?.(null);
                      } else {
                        onSelectContainer?.(container);
                      }
                    }}
                  >
                    <td className="py-3.5 px-4 font-medium text-ink font-mono">
                      {container.name}
                    </td>
                    {showSystem && (
                      <td className="py-3.5 px-4 font-medium text-ink-soft">
                        {container.system || '—'}
                      </td>
                    )}
                    <td className="py-3.5 px-4 text-right font-semibold text-accent">
                      {container.cpu.toFixed(2)}%
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-ink">
                      {formatBytes(container.memory)}
                    </td>
                    <td className="py-3.5 px-4 text-right text-success">
                      {formatBps(container.net)}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${container.health === 'Healthy'
                            ? 'chip-success border-success/20'
                            : container.health === 'Unhealthy'
                              ? 'chip-danger border-danger/20'
                              : 'chip-muted border-border'
                          }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${container.health === 'Healthy'
                              ? 'bg-success'
                              : container.health === 'Unhealthy'
                                ? 'bg-danger'
                                : 'bg-ink-soft'
                            }`}
                        />
                        {container.health}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-ink-soft max-w-[120px] truncate">
                      {container.ports || '—'}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-ink-soft max-w-[160px] truncate" title={container.image}>
                      {container.image}
                    </td>
                    <td className="py-3.5 px-4 text-ink-soft">
                      {container.status}
                    </td>
                    <td className="py-3.5 px-4 text-ink-soft">
                      {formatUpdatedTime(container.updated)}
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
