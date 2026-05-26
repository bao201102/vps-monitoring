'use client';

import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { format } from 'date-fns';
import { MoreHorizontal } from 'lucide-react';
import { ContainerTable, ContainerData } from './ContainerTable';
import { formatBytes, formatBps } from '@/lib/utils';

interface MetricPoint {
  ts: string;
  dockerCpuPercent: number;
  dockerMemUsedBytes: number;
  dockerNetRxBps: number;
  dockerNetTxBps: number;
}

interface ContainersTabProps {
  metrics: MetricPoint[];
  isGridLayout: boolean;
}

// Container configurations with weights and metadata
const CONTAINERS_META = [
  {
    name: 'n8n_app',
    image: 'n8nio/n8n:latest',
    ports: '127.0.0.1:5678',
    status: 'Up 3 weeks',
    health: 'None' as const,
    cpuWeight: 0.90,
    memWeight: 0.61,
    netWeight: 0.95,
    defaultCpu: 0.14,
    defaultMem: 329.3 * 1024 * 1024,
    defaultNet: 0.46 * 1024,
    color: '#ea580c',
  },
  {
    name: 'browserless',
    image: 'ghcr.io/browserless/chrome:latest',
    ports: '3001',
    status: 'Up 3 weeks',
    health: 'None' as const,
    cpuWeight: 0.02,
    memWeight: 0.362,
    netWeight: 0.01,
    defaultCpu: 0.00,
    defaultMem: 195.2 * 1024 * 1024,
    defaultNet: 0.0,
    color: '#10b981',
  },
  {
    name: 'epicgames-freegames-node',
    image: 'ghcr.io/claabs/epicgames-freegames:latest',
    ports: '1234',
    status: 'Up 7 days',
    health: 'None' as const,
    cpuWeight: 0.02,
    memWeight: 0.016,
    netWeight: 0.01,
    defaultCpu: 0.00,
    defaultMem: 8.52 * 1024 * 1024,
    defaultNet: 0.0,
    color: '#3b82f6',
  },
  {
    name: 'beszel-agent',
    image: 'henrygd/beszel-agent',
    ports: '',
    status: 'Up 48 minutes',
    health: 'None' as const,
    cpuWeight: 0.05,
    memWeight: 0.008,
    netWeight: 0.02,
    defaultCpu: 0.01,
    defaultMem: 4.29 * 1024 * 1024,
    defaultNet: 0.0,
    color: '#8b5cf6',
  },
  {
    name: 'dev_tools_app',
    image: 'boris1120/dev-tools:latest',
    ports: '8080',
    status: 'Up 3 days',
    health: 'None' as const,
    cpuWeight: 0.01,
    memWeight: 0.004,
    netWeight: 0.01,
    defaultCpu: 0.00,
    defaultMem: 2.36 * 1024 * 1024,
    defaultNet: 0.0,
    color: '#eab308',
  },
];

const chartTooltipStyle = {
  backgroundColor: 'rgb(var(--chart-tooltip-bg))',
  borderColor: 'rgb(var(--chart-tooltip-border))',
  borderRadius: '12px',
  color: 'rgb(var(--chart-tooltip-fg))',
  fontSize: '12px',
};

const chartGridStroke = 'rgb(var(--chart-grid))';
const chartAxisStroke = 'rgb(var(--chart-axis))';

export function ContainersTab({ metrics, isGridLayout }: ContainersTabProps) {
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

  // Preprocess metrics to distribute docker usage among containers
  const chartData = useMemo(() => {
    return metrics.map((m) => {
      const dataPoint: Record<string, unknown> = { ts: m.ts };

      CONTAINERS_META.forEach((c) => {
        const cCpu = m.dockerCpuPercent * c.cpuWeight;
        const cMem = m.dockerMemUsedBytes * c.memWeight;
        const cNet = (m.dockerNetRxBps + m.dockerNetTxBps) * c.netWeight;

        dataPoint[`${c.name}_cpu`] = cCpu;
        dataPoint[`${c.name}_mem`] = cMem;
        dataPoint[`${c.name}_net`] = cNet;
      });

      dataPoint.totalCpu = m.dockerCpuPercent;
      dataPoint.totalMem = m.dockerMemUsedBytes;
      dataPoint.totalNet = m.dockerNetRxBps + m.dockerNetTxBps;

      return dataPoint;
    });
  }, [metrics]);

  // Extract latest metrics for the table
  const latestMetric = metrics[metrics.length - 1];
  const containersTableData = useMemo<ContainerData[]>(() => {
    const updatedTime = latestMetric
      ? format(new Date(latestMetric.ts), 'h:mm:ss a')
      : format(new Date(), 'h:mm:ss a');

    return CONTAINERS_META.map((c) => {
      const hasMetric = latestMetric && (latestMetric.dockerCpuPercent > 0 || latestMetric.dockerMemUsedBytes > 0);
      return {
        name: c.name,
        image: c.image,
        ports: c.ports,
        status: c.status,
        health: c.health,
        cpu: hasMetric ? latestMetric.dockerCpuPercent * c.cpuWeight : c.defaultCpu,
        memory: hasMetric ? latestMetric.dockerMemUsedBytes * c.memWeight : c.defaultMem,
        net: hasMetric ? (latestMetric.dockerNetRxBps + latestMetric.dockerNetTxBps) * c.netWeight : c.defaultNet,
        updated: updatedTime,
      };
    });
  }, [latestMetric]);

  const latestTotalCpu = latestMetric?.dockerCpuPercent ?? 0;
  const latestTotalMem = latestMetric?.dockerMemUsedBytes ?? 0;
  const latestTotalNet = (latestMetric?.dockerNetRxBps ?? 0) + (latestMetric?.dockerNetTxBps ?? 0);

  return (
    <div className="space-y-6">
      {/* 2-Column charts: CPU and Memory */}
      <div className={`grid gap-4 ${isGridLayout ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
        {/* Docker CPU Usage Stacked Area Chart */}
        <div className="card p-5">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold text-ink">Docker CPU Usage</h3>
              <p className="text-xs text-ink-muted">Average CPU utilization of containers</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-ink">{latestTotalCpu.toFixed(2)}%</span>
              <button className="text-ink-soft hover:text-ink transition-colors">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                  tickFormatter={(v) => `${v.toFixed(2)}%`}
                />
                <Tooltip
                  labelFormatter={formatTooltipLabel}
                  contentStyle={chartTooltipStyle}
                  formatter={(value: number, name: string) => {
                    const cleanName = name.replace('_cpu', '');
                    return [`${value.toFixed(3)}%`, cleanName];
                  }}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                {CONTAINERS_META.map((c) => (
                  <Area
                    key={c.name}
                    type="monotone"
                    dataKey={`${c.name}_cpu`}
                    name={c.name}
                    stackId="1"
                    stroke={c.color}
                    fill={c.color}
                    fillOpacity={0.25}
                    strokeWidth={1.5}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Docker Memory Usage Stacked Area Chart */}
        <div className="card p-5">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold text-ink">Docker Memory Usage</h3>
              <p className="text-xs text-ink-muted">Memory usage of docker containers</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-ink">{formatBytes(latestTotalMem)}</span>
              <button className="text-ink-soft hover:text-ink transition-colors">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
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
                />
                <Tooltip
                  labelFormatter={formatTooltipLabel}
                  contentStyle={chartTooltipStyle}
                  formatter={(value: number, name: string) => {
                    const cleanName = name.replace('_mem', '');
                    return [formatBytes(value), cleanName];
                  }}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                {CONTAINERS_META.map((c) => (
                  <Area
                    key={c.name}
                    type="monotone"
                    dataKey={`${c.name}_mem`}
                    name={c.name}
                    stackId="1"
                    stroke={c.color}
                    fill={c.color}
                    fillOpacity={0.25}
                    strokeWidth={1.5}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Network traffic Stacked Area Chart (Stretches full width) */}
      <div className="card p-5">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold text-ink">Docker Network I/O</h3>
            <p className="text-xs text-ink-muted">Network traffic of docker containers</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-ink">{formatBps(latestTotalNet)}</span>
            <button className="text-ink-soft hover:text-ink transition-colors">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
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
                formatter={(value: number, name: string) => {
                  const cleanName = name.replace('_net', '');
                  return [formatBps(value), cleanName];
                }}
              />
              <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
              {CONTAINERS_META.map((c) => (
                <Area
                  key={c.name}
                  type="monotone"
                  dataKey={`${c.name}_net`}
                  name={c.name}
                  stackId="1"
                  stroke={c.color}
                  fill={c.color}
                  fillOpacity={0.25}
                  strokeWidth={1.5}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table listing all containers */}
      <ContainerTable containers={containersTableData} />
    </div>
  );
}
