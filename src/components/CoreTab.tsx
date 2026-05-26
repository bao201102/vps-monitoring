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
  Legend,
} from 'recharts';
import { format } from 'date-fns';
import { MoreHorizontal } from 'lucide-react';
import { formatBytes, formatBps } from '@/lib/utils';

interface MetricPoint {
  ts: string;
  cpuPercent: number;
  memUsedBytes: number;
  memTotalBytes: number;
  loadAvg1: number;
  loadAvg5: number;
  loadAvg15: number;
  netRxBps: number;
  netTxBps: number;
}

interface CoreTabProps {
  metrics: MetricPoint[];
  totalMemoryBytes: number;
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

export function CoreTab({ metrics, totalMemoryBytes, isGridLayout }: CoreTabProps) {
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
  const latestCpu = latestMetric?.cpuPercent ?? 0;
  const latestMemUsed = latestMetric?.memUsedBytes ?? 0;
  const latestMemTotal = latestMetric?.memTotalBytes ?? totalMemoryBytes ?? 1;

  const latestLoad1 = latestMetric?.loadAvg1 ?? 0;
  const latestLoad5 = latestMetric?.loadAvg5 ?? 0;
  const latestLoad15 = latestMetric?.loadAvg15 ?? 0;

  const latestNetRx = latestMetric?.netRxBps ?? 0;
  const latestNetTx = latestMetric?.netTxBps ?? 0;

  return (
    <div className={`grid gap-4 ${isGridLayout ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
      {/* CPU Usage Chart */}
      <div className="card p-5">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold text-ink">CPU Usage</h3>
            <p className="text-xs text-ink-muted">Average system-wide CPU utilization</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-ink">{latestCpu.toFixed(1)}%</span>
            <button className="text-ink-soft hover:text-ink transition-colors">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={metrics} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
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
                formatter={(value: number) => [`${value.toFixed(2)}%`, 'CPU Usage']}
              />
              <Area
                type="monotone"
                dataKey="cpuPercent"
                stroke="#3b82f6"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#cpuGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Memory Usage Chart */}
      <div className="card p-5">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold text-ink">Memory Usage</h3>
            <p className="text-xs text-ink-muted">Precise utilization at the recorded time</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-ink">
              {formatBytes(latestMemUsed)} / {formatBytes(latestMemTotal)}
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
                <linearGradient id="memGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
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
                formatter={(value: number) => [formatBytes(value), 'Memory Used']}
              />
              <Area
                type="monotone"
                dataKey="memUsedBytes"
                stroke="#10b981"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#memGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Load Average Chart */}
      <div className="card p-5">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold text-ink">Load Average</h3>
            <p className="text-xs text-ink-muted">System load averages over time</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-muted">
              {latestLoad1.toFixed(2)} · {latestLoad5.toFixed(2)} · {latestLoad15.toFixed(2)}
            </span>
          </div>
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
                domain={[0, 'auto']}
              />
              <Tooltip
                labelFormatter={formatTooltipLabel}
                contentStyle={chartTooltipStyle}
              />
              <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              <Line
                type="monotone"
                dataKey="loadAvg1"
                name="1 min"
                stroke="#a855f7"
                strokeWidth={1.5}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="loadAvg5"
                name="5 min"
                stroke="#3b82f6"
                strokeWidth={1.5}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="loadAvg15"
                name="15 min"
                stroke="#f97316"
                strokeWidth={1.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bandwidth Chart */}
      <div className="card p-5">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold text-ink">Bandwidth</h3>
            <p className="text-xs text-ink-muted">Network traffic of public interfaces</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-muted">
              ↓ {formatBps(latestNetRx)} · ↑ {formatBps(latestNetTx)}
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
                <linearGradient id="rxGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0d9488" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#0d9488" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="txGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#db2777" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#db2777" stopOpacity={0.0} />
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
                formatter={(value: number, name: string) => [formatBps(value), name === 'netRxBps' ? 'Download' : 'Upload']}
              />
              <Area
                type="monotone"
                dataKey="netRxBps"
                name="Download"
                stroke="#0d9488"
                strokeWidth={1.5}
                fillOpacity={1}
                fill="url(#rxGradient)"
              />
              <Area
                type="monotone"
                dataKey="netTxBps"
                name="Upload"
                stroke="#db2777"
                strokeWidth={1.5}
                fillOpacity={1}
                fill="url(#txGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
