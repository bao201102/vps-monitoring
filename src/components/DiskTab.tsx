'use client';

import React from 'react';
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
import { MoreHorizontal } from 'lucide-react';
import { formatBytes, formatBps } from '@/lib/utils';

interface MetricPoint {
  ts: string;
  diskUsedBytes: number;
  diskTotalBytes: number;
  diskReadBps: number;
  diskWriteBps: number;
}

interface DiskTabProps {
  metrics: MetricPoint[];
  totalDiskBytes: number;
  isGridLayout: boolean;
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

export function DiskTab({ metrics, totalDiskBytes, isGridLayout }: DiskTabProps) {
  // Format dates for XAxis
  const formatTime = (ts: string) => {
    try {
      return format(new Date(ts), 'h:mm a');
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

  // Get latest values
  const latestMetric = metrics[metrics.length - 1];
  const latestDiskUsed = latestMetric?.diskUsedBytes ?? 0;
  const latestDiskTotal = latestMetric?.diskTotalBytes ?? totalDiskBytes ?? 1;
  const latestRead = latestMetric?.diskReadBps ?? 0;
  const latestWrite = latestMetric?.diskWriteBps ?? 0;

  return (
    <div className={`grid gap-4 ${isGridLayout ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
      {/* Disk Usage Chart */}
      <div className="card p-5">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold text-ink">Disk Usage</h3>
            <p className="text-xs text-ink-muted">Usage of root partition</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-ink">
              {formatBytes(latestDiskUsed)} / {formatBytes(latestDiskTotal)}
            </span>
            <button className="text-ink-soft hover:text-ink transition-colors">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={metrics} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="diskGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={chartGridStroke} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="ts"
                tickFormatter={formatTime}
                stroke={chartAxisStroke}
                fontSize={10}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke={chartAxisStroke}
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatBytes(v, 0)}
                domain={[0, latestDiskTotal]}
              />
              <Tooltip
                labelFormatter={formatTooltipLabel}
                contentStyle={chartTooltipStyle}
                formatter={(value: number) => [formatBytes(value), 'Disk Used']}
              />
              <Area
                type="monotone"
                dataKey="diskUsedBytes"
                stroke="#8b5cf6"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#diskGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Disk I/O Chart */}
      <div className="card p-5">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold text-ink">Disk I/O</h3>
            <p className="text-xs text-ink-muted">Throughput of root filesystem</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-muted">
              Read: {formatBps(latestRead)} · Write: {formatBps(latestWrite)}
            </span>
            <button className="text-ink-soft hover:text-ink transition-colors">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={metrics} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="diskIoGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={chartGridStroke} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="ts"
                tickFormatter={formatTime}
                stroke={chartAxisStroke}
                fontSize={10}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke={chartAxisStroke}
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatBps}
              />
              <Tooltip
                labelFormatter={formatTooltipLabel}
                contentStyle={chartTooltipStyle}
                formatter={(value: number, name: string) => [formatBps(value), name === 'diskReadBps' ? 'Read' : 'Write']}
              />
              <Area
                type="monotone"
                dataKey="diskReadBps"
                name="Read"
                stroke="#f59e0b"
                strokeWidth={1.5}
                fillOpacity={1}
                fill="url(#diskIoGradient)"
              />
              <Area
                type="monotone"
                dataKey="diskWriteBps"
                name="Write"
                stroke="#6366f1"
                strokeWidth={1.5}
                fillOpacity={1}
                fill="none"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
