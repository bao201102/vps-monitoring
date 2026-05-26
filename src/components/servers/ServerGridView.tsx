'use client';

import React from 'react';
import Link from 'next/link';
import {
  Cpu as CpuIcon,
  HardDrive,
  Activity,
  Terminal,
  Wifi,
  Thermometer,
  Battery,
  Layers,
  Clock,
  Settings,
  ChevronRight,
  MemoryStick,
} from 'lucide-react';
import { ServerListItem } from './ServerTableView';
import { VisibleFieldsState } from './ViewConfigPopover';
import { ServerActions } from '@/components/ServerActions';
import { formatBytes, percent } from '@/lib/utils';

interface ServerGridViewProps {
  servers: ServerListItem[];
  visibleFields: VisibleFieldsState;
  onRefresh: () => void;
}

export function ServerGridView({ servers, visibleFields, onRefresh }: ServerGridViewProps) {

  // Wide progress bar helper
  const renderWideProgressBar = (label: string, Icon: React.ComponentType<any>, val: number) => {
    const barColor =
      val >= 90 ? 'bg-danger' :
      val >= 70 ? 'bg-warning' :
      val < 0.1 ? 'bg-border' : 'bg-success';
    return (
      <div className="flex items-center justify-between py-1 text-xs">
        <div className="flex items-center gap-2 text-ink-muted w-20 shrink-0">
          <Icon className="h-3.5 w-3.5" />
          <span>{label}</span>
        </div>
        <div className="flex items-center gap-3 flex-1 justify-end">
          <span className="font-semibold text-ink w-10 text-right">{val.toFixed(1)}%</span>
          <div className="flex-1 max-w-[120px] h-2 bg-bg-muted rounded-full overflow-hidden shrink-0">
            <div
              className={`h-full rounded-full transition-all ${barColor}`}
              style={{ width: `${Math.min(100, Math.max(0, val))}%` }}
            />
          </div>
        </div>
      </div>
    );
  };

  // Info row helper
  const renderInfoRow = (label: string, Icon: React.ComponentType<any>, val: React.ReactNode, isNet = false, isTemp = false) => {
    return (
      <div className="flex items-center justify-between py-1 text-xs">
        <div className="flex items-center gap-2 text-ink-muted">
          <Icon className="h-3.5 w-3.5" />
          <span>{label}</span>
        </div>
        <div className={`font-mono text-right font-medium ${
          isNet ? 'text-success' : isTemp ? 'text-warning' : 'text-ink'
        }`}>
          {val}
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
          <Link
            key={s.agentId}
            href={`/servers/${s.agentId}`}
            className="card p-5 flex flex-col justify-between hover:border-border-soft hover:bg-bg-soft/50 transition-all group cursor-pointer"
          >
            {/* Header section of Card */}
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                      s.online ? 'bg-success' : 'bg-ink-soft'
                    }`}
                  />
                  <div className="min-w-0">
                    <h3 className="font-bold text-ink truncate text-sm">
                      {s.label || s.hostname}
                    </h3>
                    <p className="text-[10px] text-ink-soft truncate mt-0.5">
                      {s.cpuCores} CPU · {formatBytes(s.totalMemoryBytes)} RAM
                    </p>
                  </div>
                </div>

                <div onClick={(e) => e.preventDefault()}>
                  {/* Actions Dropdown context menu */}
                  <div onClick={(e) => e.stopPropagation()} className="pointer-events-auto">
                    <ServerActions
                      agentId={s.agentId}
                      label={s.label}
                      hostname={s.hostname}
                      onDone={onRefresh}
                      size="sm"
                    />
                  </div>
                </div>
              </div>

              {/* Vertical Metrics List */}
              <div className="py-3 divide-y divide-border/30">
                {visibleFields.cpu && renderWideProgressBar('CPU', CpuIcon, cpu)}
                {visibleFields.memory && renderWideProgressBar('Memory', MemoryStick, memPct)}
                {visibleFields.disk && renderWideProgressBar('Disk', HardDrive, diskPct)}
                {visibleFields.gpu && renderWideProgressBar('GPU', Activity, gpuPct)}

                {visibleFields.loadAvg &&
                  renderInfoRow(
                    'Load Avg',
                    Terminal,
                    <span className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-success shrink-0" />
                      {loadStr}
                    </span>
                  )}

                {visibleFields.net && renderInfoRow('Net', Wifi, netStr, true)}
                {visibleFields.temp && renderInfoRow('Temp', Thermometer, temp, false, true)}
                {visibleFields.bat && renderInfoRow('Bat', Battery, bat)}
                {visibleFields.services && renderInfoRow('Services', Layers, servicesStr)}
                {visibleFields.uptime && renderInfoRow('Uptime', Clock, uptime)}
              </div>
            </div>

            {/* Bottom details card button link */}
            <div className="pt-2 border-t border-border/40 flex items-center justify-end">
              <span
                className="text-[11px] font-semibold text-ink-soft group-hover:text-[#3b82f6] flex items-center gap-1 transition-colors"
              >
                View details
                <ChevronRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
