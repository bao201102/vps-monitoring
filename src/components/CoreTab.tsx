'use client';

import React, { useMemo } from 'react';
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
  swapUsedBytes: number;
  swapTotalBytes: number;
  loadAvg1: number;
  loadAvg5: number;
  loadAvg15: number;
  netRxBps: number;
  netTxBps: number;
  temperatureC: number;
  temperatures: Record<string, number>;
}

interface CoreTabProps {
  metrics: MetricPoint[];
  totalMemoryBytes: number;
  isGridLayout: boolean;
}

const chartTooltipStyle = {
  backgroundColor: 'rgba(var(--chart-tooltip-bg), 0.8)',
  backdropFilter: 'blur(12px)',
  borderColor: 'rgba(var(--color-border), 0.6)',
  borderRadius: '14px',
  color: 'rgb(var(--chart-tooltip-fg))',
  fontSize: '12px',
  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
  padding: '10px 14px',
  border: '1px solid rgba(var(--color-border), 0.4)',
};

const chartGridStroke = 'rgba(var(--chart-grid), 0.4)';
const chartAxisStroke = 'rgb(var(--chart-axis))';

/** Generate a stable HSL color for each sensor name based on its index */
function getSensorColor(index: number, total: number): string {
  const hue = Math.round((index * 360) / Math.max(total, 1)) % 360;
  return `hsl(${hue}, 60%, 55%)`;
}

export function CoreTab({ metrics, totalMemoryBytes, isGridLayout }: CoreTabProps) {
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
  const latestCpu = latestMetric?.cpuPercent ?? 0;
  const latestMemUsed = latestMetric?.memUsedBytes ?? 0;
  const latestMemTotal = latestMetric?.memTotalBytes ?? totalMemoryBytes ?? 1;
  const latestLoad1 = latestMetric?.loadAvg1 ?? 0;
  const latestLoad5 = latestMetric?.loadAvg5 ?? 0;
  const latestLoad15 = latestMetric?.loadAvg15 ?? 0;
  const latestNetRx = latestMetric?.netRxBps ?? 0;
  const latestNetTx = latestMetric?.netTxBps ?? 0;

  // Swap chart - show only when swap exists
  const latestSwapTotal = latestMetric?.swapTotalBytes ?? 0;
  const latestSwapUsed = latestMetric?.swapUsedBytes ?? 0;
  const hasSwap = latestSwapTotal > 0;

  // Temperature: collect all sensor names from entire history for stable ordering
  const sensorNames = useMemo(() => {
    const sums: Record<string, number> = {};
    for (const m of metrics) {
      const temps = m.temperatures;
      if (temps && typeof temps === 'object') {
        for (const [key, val] of Object.entries(temps)) {
          sums[key] = (sums[key] ?? 0) + val;
        }
      }
    }
    // Sort by avg descending (hottest sensors first, like Beszel)
    return Object.entries(sums)
      .sort((a, b) => b[1] - a[1])
      .map(([k]) => k);
  }, [metrics]);

  const hasTemperature = sensorNames.length > 0;

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
                  <stop offset="5%" stopColor="rgb(var(--color-accent))" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="rgb(var(--color-accent))" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={chartGridStroke} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="ts" tickFormatter={formatTime} stroke={chartAxisStroke} fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke={chartAxisStroke} fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${v.toFixed(0)}%`} domain={[0, 100]} />
              <Tooltip labelFormatter={formatTooltipLabel} contentStyle={chartTooltipStyle} formatter={(value: number) => [`${value.toFixed(2)}%`, 'CPU Usage']} />
              <Area type="monotone" dataKey="cpuPercent" stroke="rgb(var(--color-accent))" strokeWidth={2} fillOpacity={1} fill="url(#cpuGradient)" />
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
                  <stop offset="5%" stopColor="rgb(var(--color-success))" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="rgb(var(--color-success))" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={chartGridStroke} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="ts" tickFormatter={formatTime} stroke={chartAxisStroke} fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke={chartAxisStroke} fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => formatBytes(v, 0)} domain={[0, latestMemTotal]} />
              <Tooltip labelFormatter={formatTooltipLabel} contentStyle={chartTooltipStyle} formatter={(value: number) => [formatBytes(value), 'Memory Used']} />
              <Area type="monotone" dataKey="memUsedBytes" stroke="rgb(var(--color-success))" strokeWidth={2} fillOpacity={1} fill="url(#memGradient)" />
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
          <span className="text-xs text-ink-muted">
            {latestLoad1.toFixed(2)} · {latestLoad5.toFixed(2)} · {latestLoad15.toFixed(2)}
          </span>
        </div>
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={metrics} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <CartesianGrid stroke={chartGridStroke} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="ts" tickFormatter={formatTime} stroke={chartAxisStroke} fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke={chartAxisStroke} fontSize={10} tickLine={false} axisLine={false} domain={[0, 'auto']} />
              <Tooltip labelFormatter={formatTooltipLabel} contentStyle={chartTooltipStyle} />
              <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              <Line type="monotone" dataKey="loadAvg1" name="1 min" stroke="rgb(var(--color-accent))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="loadAvg5" name="5 min" stroke="rgb(var(--color-warning))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="loadAvg15" name="15 min" stroke="rgb(var(--color-danger))" strokeWidth={2} dot={false} />
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
                  <stop offset="5%" stopColor="rgb(var(--color-success))" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="rgb(var(--color-success))" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="txGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="rgb(var(--color-danger))" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="rgb(var(--color-danger))" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={chartGridStroke} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="ts" tickFormatter={formatTime} stroke={chartAxisStroke} fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke={chartAxisStroke} fontSize={10} tickLine={false} axisLine={false} tickFormatter={formatBps} />
              <Tooltip labelFormatter={formatTooltipLabel} contentStyle={chartTooltipStyle} formatter={(value: number, name: string) => [formatBps(value), name === 'netRxBps' ? 'Download' : 'Upload']} />
              <Area type="monotone" dataKey="netRxBps" name="Download" stroke="rgb(var(--color-success))" strokeWidth={2} fillOpacity={1} fill="url(#rxGradient)" />
              <Area type="monotone" dataKey="netTxBps" name="Upload" stroke="rgb(var(--color-danger))" strokeWidth={2} fillOpacity={1} fill="url(#txGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Swap Usage Chart — only when swap is configured on the system */}
      {hasSwap && (
        <div className="card p-5">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold text-ink">Swap Usage</h3>
              <p className="text-xs text-ink-muted">Swap space used by the system</p>
            </div>
            <span className="text-sm font-medium text-ink">
              {formatBytes(latestSwapUsed)} / {formatBytes(latestSwapTotal)}
            </span>
          </div>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="swapGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="rgb(var(--color-warning))" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="rgb(var(--color-warning))" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={chartGridStroke} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="ts" tickFormatter={formatTime} stroke={chartAxisStroke} fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke={chartAxisStroke} fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => formatBytes(v, 0)} domain={[0, latestSwapTotal]} />
                <Tooltip labelFormatter={formatTooltipLabel} contentStyle={chartTooltipStyle} formatter={(value: number) => [formatBytes(value), 'Swap Used']} />
                <Area type="monotone" dataKey="swapUsedBytes" stroke="rgb(var(--color-warning))" strokeWidth={2} fillOpacity={1} fill="url(#swapGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Temperature Multi-Sensor Chart — only when sensor data available */}
      {hasTemperature && (
        <div className={`card p-5 ${isGridLayout && !hasSwap ? 'md:col-span-2' : ''}`}>
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold text-ink">Temperature</h3>
              <p className="text-xs text-ink-muted">Temperatures of system sensors</p>
            </div>
          </div>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid stroke={chartGridStroke} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="ts" tickFormatter={formatTime} stroke={chartAxisStroke} fontSize={10} tickLine={false} axisLine={false} />
                <YAxis
                  stroke={chartAxisStroke}
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${v.toFixed(0)}°C`}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  labelFormatter={formatTooltipLabel}
                  contentStyle={chartTooltipStyle}
                  formatter={(value: number, name: string) => [`${value.toFixed(1)}°C`, name]}
                />
                {sensorNames.length <= 8 && (
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }}
                  />
                )}
                {sensorNames.map((sensor, i) => (
                  <Line
                    key={sensor}
                    type="monotone"
                    dataKey={(entry: any) => entry.temperatures?.[sensor] ?? null}
                    name={sensor}
                    stroke={getSensorColor(i, sensorNames.length)}
                    strokeWidth={1.5}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
