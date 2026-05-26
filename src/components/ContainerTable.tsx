'use client';

import React, { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { formatBytes, formatBps } from '@/lib/utils';

export interface ContainerData {
  name: string;
  cpu: number; // percentage
  memory: number; // bytes
  net: number; // bps
  health: 'Healthy' | 'Unhealthy' | 'None';
  ports: string;
  image: string;
  status: string;
  updated: string;
}

interface ContainerTableProps {
  containers: ContainerData[];
}

export function ContainerTable({ containers }: ContainerTableProps) {
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
          c.ports.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];

        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else if (typeof valA === 'number' && typeof valB === 'number') {
          return sortAsc ? valA - valB : valB - valA;
        }
        return 0;
      });
  }, [containers, searchQuery, sortField, sortAsc]);

  const renderSortIndicator = (field: keyof ContainerData) => {
    if (sortField !== field) return null;
    return sortAsc ? ' ↑' : ' ↓';
  };

  return (
    <div className="card overflow-hidden">
      {/* Table Header Section */}
      <div className="flex flex-col gap-3 px-5 py-4 border-b border-border sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-ink">All Containers</h2>
          <p className="text-xs text-ink-muted">Click on a container to view more information.</p>
        </div>
        <div className="relative max-w-xs w-full">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-ink-soft">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            placeholder="Filter..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-9"
          />
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-border text-ink-soft uppercase tracking-wider font-semibold select-none bg-bg-muted/40">
              <th className="py-3 px-4 cursor-pointer hover:text-ink transition-colors" onClick={() => handleSort('name')}>
                Name{renderSortIndicator('name')}
              </th>
              <th className="py-3 px-4 text-right cursor-pointer hover:text-ink transition-colors" onClick={() => handleSort('cpu')}>
                CPU{renderSortIndicator('cpu')}
              </th>
              <th className="py-3 px-4 text-right cursor-pointer hover:text-ink transition-colors" onClick={() => handleSort('memory')}>
                Memory{renderSortIndicator('memory')}
              </th>
              <th className="py-3 px-4 text-right cursor-pointer hover:text-ink transition-colors" onClick={() => handleSort('net')}>
                Net{renderSortIndicator('net')}
              </th>
              <th className="py-3 px-4 cursor-pointer hover:text-ink transition-colors" onClick={() => handleSort('health')}>
                Health{renderSortIndicator('health')}
              </th>
              <th className="py-3 px-4 cursor-pointer hover:text-ink transition-colors" onClick={() => handleSort('ports')}>
                Ports{renderSortIndicator('ports')}
              </th>
              <th className="py-3 px-4 cursor-pointer hover:text-ink transition-colors" onClick={() => handleSort('image')}>
                Image{renderSortIndicator('image')}
              </th>
              <th className="py-3 px-4 cursor-pointer hover:text-ink transition-colors" onClick={() => handleSort('status')}>
                Status{renderSortIndicator('status')}
              </th>
              <th className="py-3 px-4 cursor-pointer hover:text-ink transition-colors" onClick={() => handleSort('updated')}>
                Updated{renderSortIndicator('updated')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-ink">
            {filteredContainers.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-ink-soft">
                  No containers found
                </td>
              </tr>
            ) : (
              filteredContainers.map((container, idx) => (
                <tr
                  key={container.name + idx}
                  className="hover:bg-bg-soft/50 transition-colors cursor-pointer group"
                >
                  <td className="py-3.5 px-4 font-medium text-ink font-mono">
                    {container.name}
                  </td>
                  <td className="py-3.5 px-4 text-right font-semibold text-[#3b82f6]">
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
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        container.health === 'Healthy'
                          ? 'chip-success border-success/20'
                          : container.health === 'Unhealthy'
                          ? 'chip-danger border-danger/20'
                          : 'chip-muted border-border'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          container.health === 'Healthy'
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
                    {container.updated}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
