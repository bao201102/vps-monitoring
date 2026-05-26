'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronRight,
  ArrowUpDown,
  Cpu as CpuIcon,
  MemoryStick,
  HardDrive,
  Activity,
  Terminal,
  Wifi,
  Thermometer,
  Battery,
  Layers,
  Clock,
  Server,
} from 'lucide-react';
import { VisibleFieldsState } from './ViewConfigPopover';
import { OsBadge } from '@/components/OsBadge';
import { ServerActions } from '@/components/ServerActions';
import { formatBytes, percent, timeAgo } from '@/lib/utils';

export interface ServerListItem {
  agentId: string;
  hostname: string;
  label?: string;
  os: string;
  osVersion: string;
  cpuCores: number;
  totalMemoryBytes: number;
  totalDiskBytes: number;
  publicIp?: string;
  privateIp?: string;
  online: boolean;
  lastSeenAt?: string;
  servicesCount?: number;
  servicesFailedCount?: number;
  latest: {
    cpuPercent: number;
    memUsedBytes: number;
    memTotalBytes: number;
    diskUsedBytes: number;
    diskTotalBytes: number;
    gpuUtilPercent?: number;
    netRxBps?: number;
    netTxBps?: number;
    temperatureC?: number;
    uptimeSeconds?: number;
    loadAvg1?: number;
    loadAvg5?: number;
    loadAvg15?: number;
    dockerContainerCount?: number;
  } | null;
}

interface ServerTableViewProps {
  servers: ServerListItem[];
  sortBy: string;
  setSortBy: (field: string) => void;
  sortOrder: 'asc' | 'desc';
  setSortOrder: (o: 'asc' | 'desc') => void;
  visibleFields: VisibleFieldsState;
  onRefresh: () => void;
}

export function ServerTableView({
  servers,
  sortBy,
  setSortBy,
  sortOrder,
  setSortOrder,
  visibleFields,
  onRefresh,
}: ServerTableViewProps) {
  const router = useRouter();

  const handleHeaderClick = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const renderSortArrow = (field: string) => {
    if (sortBy !== field) return <ArrowUpDown className="ml-1 h-3 w-3 text-ink-soft opacity-40 group-hover:opacity-100" />;
    return (
      <span className="ml-1 font-bold text-accent">
        {sortOrder === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  // Mini progress bar helper
  const renderMiniProgressBar = (val: number) => {
    const color =
      val >= 90 ? 'bg-danger' :
      val >= 70 ? 'bg-warning' :
      val < 0.1 ? 'bg-border' : 'bg-success';
    return (
      <div className="flex items-center gap-2">
        <span className="font-semibold text-ink w-10 text-right">{val.toFixed(1)}%</span>
        <div className="w-12 h-1.5 bg-bg-muted rounded-full overflow-hidden shrink-0">
          <div
            className={`h-full rounded-full transition-all ${color}`}
            style={{ width: `${Math.min(100, Math.max(0, val))}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="border-b border-border text-ink-soft font-semibold bg-bg-muted/40 text-xs">
            {/* Main Host column (Always visible) */}
            <th
              className="py-3 px-5 cursor-pointer select-none group hover:text-ink transition-colors"
              onClick={() => handleHeaderClick('host')}
            >
              <span className="flex items-center gap-1.5">
                <Server className="h-3.5 w-3.5 text-ink-soft/80 group-hover:text-ink transition-colors shrink-0" />
                <span>System</span>
                {renderSortArrow('host')}
              </span>
            </th>

            {/* Dynamic Columns based on visibleFields */}
            {visibleFields.cpu && (
              <th
                className="py-3 px-3 cursor-pointer select-none group hover:text-ink transition-colors text-right"
                onClick={() => handleHeaderClick('cpu')}
              >
                <span className="flex items-center justify-end gap-1.5">
                  <CpuIcon className="h-3.5 w-3.5 text-ink-soft/80 group-hover:text-ink transition-colors shrink-0" />
                  <span>CPU</span>
                  {renderSortArrow('cpu')}
                </span>
              </th>
            )}

            {visibleFields.memory && (
              <th
                className="py-3 px-3 cursor-pointer select-none group hover:text-ink transition-colors text-right"
                onClick={() => handleHeaderClick('memory')}
              >
                <span className="flex items-center justify-end gap-1.5">
                  <MemoryStick className="h-3.5 w-3.5 text-ink-soft/80 group-hover:text-ink transition-colors shrink-0" />
                  <span>Memory</span>
                  {renderSortArrow('memory')}
                </span>
              </th>
            )}

            {visibleFields.disk && (
              <th
                className="py-3 px-3 cursor-pointer select-none group hover:text-ink transition-colors text-right"
                onClick={() => handleHeaderClick('disk')}
              >
                <span className="flex items-center justify-end gap-1.5">
                  <HardDrive className="h-3.5 w-3.5 text-ink-soft/80 group-hover:text-ink transition-colors shrink-0" />
                  <span>Disk</span>
                  {renderSortArrow('disk')}
                </span>
              </th>
            )}

            {visibleFields.gpu && (
              <th
                className="py-3 px-3 cursor-pointer select-none group hover:text-ink transition-colors text-right"
                onClick={() => handleHeaderClick('gpu')}
              >
                <span className="flex items-center justify-end gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-ink-soft/80 group-hover:text-ink transition-colors shrink-0" />
                  <span>GPU</span>
                  {renderSortArrow('gpu')}
                </span>
              </th>
            )}

            {visibleFields.loadAvg && (
              <th
                className="py-3 px-3 cursor-pointer select-none group hover:text-ink transition-colors"
                onClick={() => handleHeaderClick('loadAvg')}
              >
                <span className="flex items-center gap-1.5">
                  <Terminal className="h-3.5 w-3.5 text-ink-soft/80 group-hover:text-ink transition-colors shrink-0" />
                  <span>Load Avg</span>
                  {renderSortArrow('loadAvg')}
                </span>
              </th>
            )}

            {visibleFields.net && (
              <th
                className="py-3 px-3 cursor-pointer select-none group hover:text-ink transition-colors"
                onClick={() => handleHeaderClick('net')}
              >
                <span className="flex items-center gap-1.5">
                  <Wifi className="h-3.5 w-3.5 text-ink-soft/80 group-hover:text-ink transition-colors shrink-0" />
                  <span>Net</span>
                  {renderSortArrow('net')}
                </span>
              </th>
            )}

            {visibleFields.temp && (
              <th
                className="py-3 px-3 cursor-pointer select-none group hover:text-ink transition-colors"
                onClick={() => handleHeaderClick('temp')}
              >
                <span className="flex items-center gap-1.5">
                  <Thermometer className="h-3.5 w-3.5 text-ink-soft/80 group-hover:text-ink transition-colors shrink-0" />
                  <span>Temp</span>
                  {renderSortArrow('temp')}
                </span>
              </th>
            )}

            {visibleFields.bat && (
              <th
                className="py-3 px-3 cursor-pointer select-none group hover:text-ink transition-colors"
                onClick={() => handleHeaderClick('bat')}
              >
                <span className="flex items-center gap-1.5">
                  <Battery className="h-3.5 w-3.5 text-ink-soft/80 group-hover:text-ink transition-colors shrink-0" />
                  <span>Bat</span>
                  {renderSortArrow('bat')}
                </span>
              </th>
            )}

            {visibleFields.services && (
              <th
                className="py-3 px-3 cursor-pointer select-none group hover:text-ink transition-colors"
                onClick={() => handleHeaderClick('services')}
              >
                <span className="flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-ink-soft/80 group-hover:text-ink transition-colors shrink-0" />
                  <span>Services</span>
                  {renderSortArrow('services')}
                </span>
              </th>
            )}

            {visibleFields.uptime && (
              <th
                className="py-3 px-3 cursor-pointer select-none group hover:text-ink transition-colors"
                onClick={() => handleHeaderClick('uptime')}
              >
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-ink-soft/80 group-hover:text-ink transition-colors shrink-0" />
                  <span>Uptime</span>
                  {renderSortArrow('uptime')}
                </span>
              </th>
            )}


            {/* Actions column */}
            {visibleFields.actions && (
              <th className="py-3 px-3 text-center font-semibold">
                Actions
              </th>
            )}

            {/* Chevron Link column */}
            <th className="w-10 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border text-ink">
          {servers.map((s) => {
            const cpu = s.latest?.cpuPercent ?? 0;
            const memPct = percent(
              s.latest?.memUsedBytes ?? 0,
              s.latest?.memTotalBytes ?? s.totalMemoryBytes
            );
            const diskPct = percent(
              s.latest?.diskUsedBytes ?? 0,
              s.latest?.diskTotalBytes ?? s.totalDiskBytes
            );
            const gpuPct = s.latest?.gpuUtilPercent ?? 0;

            const load1 = s.latest?.loadAvg1 ?? 0;
            const load5 = s.latest?.loadAvg5 ?? 0;
            const load15 = s.latest?.loadAvg15 ?? 0;
            const loadStr = `${load1.toFixed(2)} ${load5.toFixed(2)} ${load15.toFixed(2)}`;

            const netRx = s.latest?.netRxBps ?? 0;
            const netTx = s.latest?.netTxBps ?? 0;
            const netSpeedKb = (netRx + netTx) / 1024;
            const netStr = `${netSpeedKb.toFixed(2)} KB/s`;

            const temp = s.latest?.temperatureC ? `${s.latest.temperatureC.toFixed(0)}°C` : '—';
            const bat = '—';

            const servicesCount = s.servicesCount ?? 0;
            const servicesFailedCount = s.servicesFailedCount ?? 0;
            const servicesStr = servicesCount > 0
              ? `${servicesCount} (failed: ${servicesFailedCount})`
              : '—';

            const uptime = s.latest?.uptimeSeconds
              ? `${Math.floor(s.latest.uptimeSeconds / 86400)} days`
              : '—';

            return (
              <tr
                key={s.agentId}
                className="hover:bg-bg-soft/50 transition-colors cursor-pointer group"
                onClick={() => router.push(`/servers/${s.agentId}`)}
              >
                {/* System ID/Hostname info */}
                <td className="py-3 px-5">
                  <Link href={`/servers/${s.agentId}`} className="flex items-center gap-3">
                    <span
                      className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                        s.online ? 'bg-success' : 'bg-ink-soft'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="font-semibold text-ink truncate">
                        {s.label || s.hostname}
                      </div>
                      <div className="text-[10px] text-ink-soft truncate">
                        {s.cpuCores} CPU · {formatBytes(s.totalMemoryBytes)} RAM
                      </div>
                    </div>
                  </Link>
                </td>

                {/* CPU */}
                {visibleFields.cpu && (
                  <td className="py-3 px-3 text-right">
                    {renderMiniProgressBar(cpu)}
                  </td>
                )}

                {/* Memory */}
                {visibleFields.memory && (
                  <td className="py-3 px-3 text-right">
                    {renderMiniProgressBar(memPct)}
                  </td>
                )}

                {/* Disk */}
                {visibleFields.disk && (
                  <td className="py-3 px-3 text-right">
                    {renderMiniProgressBar(diskPct)}
                  </td>
                )}

                {/* GPU */}
                {visibleFields.gpu && (
                  <td className="py-3 px-3 text-right">
                    {renderMiniProgressBar(gpuPct)}
                  </td>
                )}

                {/* Load Avg */}
                {visibleFields.loadAvg && (
                  <td className="py-3 px-3 font-mono">
                    <span className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-success shrink-0" />
                      {loadStr}
                    </span>
                  </td>
                )}

                {/* Net */}
                {visibleFields.net && (
                  <td className="py-3 px-3 font-mono text-success">
                    {netStr}
                  </td>
                )}

                {/* Temp */}
                {visibleFields.temp && (
                  <td className="py-3 px-3 text-warning">
                    {temp}
                  </td>
                )}

                {/* Bat */}
                {visibleFields.bat && (
                  <td className="py-3 px-3 text-ink-soft">
                    {bat}
                  </td>
                )}

                {/* Services */}
                {visibleFields.services && (
                  <td className="py-3 px-3 text-ink-soft font-mono">
                    {servicesStr}
                  </td>
                )}

                {/* Uptime */}
                {visibleFields.uptime && (
                  <td className="py-3 px-3 text-ink-soft">
                    {uptime}
                  </td>
                )}



                {/* Actions context actions */}
                {visibleFields.actions && (
                  <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-center">
                      <ServerActions
                        agentId={s.agentId}
                        label={s.label}
                        hostname={s.hostname}
                        onDone={onRefresh}
                        size="sm"
                      />
                    </div>
                  </td>
                )}

                {/* Link Chevron */}
                <td className="py-3 text-right pr-4">
                  <Link
                    href={`/servers/${s.agentId}`}
                    className="inline-flex items-center text-ink-soft group-hover:text-ink transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
