'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { ServiceData } from './ServicesTab';
import { formatBytes, cn } from '@/lib/utils';

interface ServiceDetailPanelProps {
  agentId: string;
  service: ServiceData;
  onClose: () => void;
  mutateServices: () => void;
}

export function ServiceDetailPanel({
  service,
  onClose,
}: ServiceDetailPanelProps) {
  const [mounted, setMounted] = useState(false);

  // Sync scroll lock
  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const formatCpuTime = (nsec: number | null | undefined) => {
    if (nsec === null || nsec === undefined || nsec === 0) return '—';
    const totalSeconds = Math.floor(nsec / 1_000_000_000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
    return parts.join(' ');
  };

  const formatMemoryLimit = (limit: number | null | undefined) => {
    if (limit === null || limit === undefined || limit === 0 || limit >= 18446744073709551615 || limit === -1) {
      return 'Unlimited';
    }
    return formatBytes(limit);
  };

  const formatLifecycleTime = (ts: string | null | undefined) => {
    if (!ts) return '—';
    try {
      const date = new Date(ts);
      if (isNaN(date.getTime())) return ts;
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
    } catch {
      return ts;
    }
  };

  const getActiveStateDisplay = () => {
    const isRunning = service.state === 'Active' && service.subState === 'Running';
    const isFailed = service.state === 'Failed' || service.subState === 'Failed';
    const dotColor = isRunning ? 'bg-success' : isFailed ? 'bg-danger' : 'bg-ink-soft';
    const stateStr = `${service.state?.toLowerCase() ?? ''} (${service.subState?.toLowerCase() ?? ''})`;
    return (
      <span className="inline-flex items-center gap-1.5 font-semibold text-ink capitalize">
        <span className={cn("h-2 w-2 rounded-full", dotColor, isRunning && "animate-pulse")} />
        {stateStr || '—'}
      </span>
    );
  };

  if (!mounted) return null;

  const sections = [
    {
      title: 'Service Details',
      rows: [
        { label: 'Name', value: service.name, isMono: true },
        { label: 'Description', value: service.description || '—' },
        { label: 'Load state', value: service.loadState || '—' },
        { 
          label: 'Boot state', 
          value: service.unitFileState ? `${service.unitFileState} (preset: ${service.unitFileState})` : '—' 
        },
        { label: 'Unit file', value: service.fragmentPath || '—', isMono: true },
        { label: 'Active state', value: getActiveStateDisplay(), isCustom: true },
        { label: 'Status', value: service.statusText || service.result || 'success' },
      ],
    },
    {
      title: 'Runtime Metrics',
      rows: [
        { label: 'Main PID', value: service.mainPid ?? '—', isMono: true },
        { 
          label: 'Tasks', 
          value: service.tasksCurrent !== null && service.tasksCurrent !== undefined
            ? `${service.tasksCurrent} ${service.tasksMax && service.tasksMax > 0 ? `(limit: ${service.tasksMax})` : ''}`
            : '—'
        },
        { label: 'CPU time', value: formatCpuTime(service.cpuUsageNSec) },
        { label: 'Memory', value: service.memory !== null && service.memory !== undefined ? formatBytes(service.memory) : '—' },
        { label: 'Memory peak', value: service.memoryPeak !== null && service.memoryPeak !== undefined ? formatBytes(service.memoryPeak) : '—' },
        { label: 'Memory limit', value: formatMemoryLimit(service.memoryLimit) },
        { label: 'Restarts', value: service.nRestarts ?? '0' },
      ],
    },
    {
      title: 'Relationships',
      rows: [
        { label: 'Wants', value: service.wants && service.wants.length > 0 ? service.wants.join(', ') : '—', isMono: true },
        { label: 'Requires', value: service.requires && service.requires.length > 0 ? service.requires.join(', ') : '—', isMono: true },
        { label: 'Conflicts', value: service.conflicts && service.conflicts.length > 0 ? service.conflicts.join(', ') : '—', isMono: true },
        { label: 'Before', value: service.before && service.before.length > 0 ? service.before.join(', ') : '—', isMono: true },
        { label: 'After', value: service.after && service.after.length > 0 ? service.after.join(', ') : '—', isMono: true },
      ],
    },
    {
      title: 'Lifecycle',
      rows: [
        { label: 'Became active', value: formatLifecycleTime(service.activeEnterTimestamp) },
      ],
    },
    {
      title: 'Capabilities',
      rows: [
        { label: 'Can start', value: service.canStart ?? 'Yes' },
        { label: 'Can stop', value: service.canStop ?? 'Yes' },
        { label: 'Can reload', value: service.canReload ?? 'No' },
      ],
    },
  ];

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
        <div className="p-5 border-b border-border flex justify-between items-center shrink-0 bg-bg-card/45 backdrop-blur-md">
          <h2 className="text-lg font-bold tracking-tight text-ink">
            Service Details
          </h2>
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
          {sections.map((section, idx) => (
            <div key={idx} className="space-y-2">
              <h3 className="text-sm font-bold text-ink-muted px-1">
                {section.title}
              </h3>
              <div className="bg-[#121214] border border-border rounded-xl overflow-hidden divide-y divide-border/60">
                {section.rows.map((row, rowIdx) => (
                  <div key={rowIdx} className="flex px-4 py-3 text-xs items-start leading-relaxed">
                    <div className="w-40 text-ink-soft shrink-0 font-medium">
                      {row.label}
                    </div>
                    <div className={cn(
                      "text-ink flex-grow break-all",
                      row.isMono && "font-mono text-ink-muted"
                    )}>
                      {row.isCustom ? row.value : (row.value as string)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>,
    document.body
  );
}
