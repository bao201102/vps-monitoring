'use client';

import React from 'react';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import { formatBytes } from '@/lib/utils';

interface MetricPoint {
  ts: string;
  gpuUtilPercent: number;
  gpuMemUsedBytes: number;
  gpuMemTotalBytes: number;
  gpuPowerWatts: number;
}

interface GpuTabProps {
  metrics: MetricPoint[];
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

export function GpuTab({ metrics, isGridLayout }: GpuTabProps) {
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

  const latestMetric = metrics[metrics.length - 1];
  const latestUtil = latestMetric?.gpuUtilPercent ?? 0;
  const latestMemUsed = latestMetric?.gpuMemUsedBytes ?? 0;
  const latestMemTotal = latestMetric?.gpuMemTotalBytes ?? 1;
  const latestPower = latestMetric?.gpuPowerWatts ?? 0;
  const hasPowerData = metrics.some((m) => m.gpuPowerWatts > 0);

  return (
    <div className={`grid gap-4 ${isGridLayout ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
      {/* GPU Usage Chart */}
      <div className="card p-5">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold text-ink">GPU Usage</h3>
            <p className="text-xs text-ink-muted">Average GPU core utilization</p>
          </div>
          <span className="text-sm font-medium text-ink">{latestUtil.toFixed(1)}%</span>
        </div>
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={metrics} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gpuUtilGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0.0} />
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
                tickFormatter={(v) => `${v.toFixed(0)}%`}
                domain={[0, 100]}
              />
              <Tooltip
                labelFormatter={formatTooltipLabel}
                contentStyle={chartTooltipStyle}
                formatter={(value: number) => [`${value.toFixed(2)}%`, 'GPU Usage']}
              />
              <Area
                type="monotone"
                dataKey="gpuUtilPercent"
                stroke="#a855f7"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#gpuUtilGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* GPU VRAM Chart */}
      <div className="card p-5">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold text-ink">GPU VRAM</h3>
            <p className="text-xs text-ink-muted">Precise utilization at the recorded time</p>
          </div>
          <span className="text-sm font-medium text-ink">
            {formatBytes(latestMemUsed)} / {formatBytes(latestMemTotal)}
          </span>
        </div>
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={metrics} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="gpuVramGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
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
                domain={[0, latestMemTotal]}
              />
              <Tooltip
                labelFormatter={formatTooltipLabel}
                contentStyle={chartTooltipStyle}
                formatter={(value: number) => [formatBytes(value), 'VRAM Used']}
              />
              <Area
                type="monotone"
                dataKey="gpuMemUsedBytes"
                stroke="#06b6d4"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#gpuVramGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* GPU Power Draw Chart — only when data present */}
      {hasPowerData && (
        <div className={`card p-5 ${!isGridLayout ? '' : 'md:col-span-2'}`}>
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold text-ink">GPU Power Draw</h3>
              <p className="text-xs text-ink-muted">Average power consumption</p>
            </div>
            <span className="text-sm font-medium text-ink">{latestPower.toFixed(1)} W</span>
          </div>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
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
                  tickFormatter={(v) => `${v.toFixed(0)}W`}
                />
                <Tooltip
                  labelFormatter={formatTooltipLabel}
                  contentStyle={chartTooltipStyle}
                  formatter={(value: number) => [`${value.toFixed(1)} W`, 'Power Draw']}
                />
                <Line
                  type="monotone"
                  dataKey="gpuPowerWatts"
                  stroke="#f97316"
                  strokeWidth={1.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
