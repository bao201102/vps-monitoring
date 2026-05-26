'use client';

import React, { useMemo, useState } from 'react';
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
import { MoreHorizontal, Loader2 } from 'lucide-react';
import useSWR from 'swr';
import { ContainerTable, ContainerData } from './ContainerTable';
import { ContainerDetailPanel } from './ContainerDetailPanel';
import { formatBytes, formatBps } from '@/lib/utils';

interface MetricPoint {
  ts: string;
  dockerCpuPercent: number;
  dockerMemUsedBytes: number;
  dockerNetRxBps: number;
  dockerNetTxBps: number;
}

interface ContainersTabProps {
  agentId: string;
  metrics: MetricPoint[];
  isGridLayout: boolean;
  agentLabel?: string;
  agentHostname?: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const chartTooltipStyle = {
  backgroundColor: 'rgb(var(--chart-tooltip-bg))',
  borderColor: 'rgb(var(--chart-tooltip-border))',
  borderRadius: '12px',
  color: 'rgb(var(--chart-tooltip-fg))',
  fontSize: '12px',
};

const chartGridStroke = 'rgb(var(--chart-grid))';
const chartAxisStroke = 'rgb(var(--chart-axis))';

export function ContainersTab({
  agentId,
  metrics,
  isGridLayout,
  agentLabel,
  agentHostname,
}: ContainersTabProps) {
  const [selectedContainer, setSelectedContainer] = useState<ContainerData | null>(null);

  const { data, isLoading } = useSWR<{ containers: ContainerData[] }>(
    `/api/containers?agentId=${agentId}`,
    fetcher,
    { refreshInterval: 5000 }
  );

  const containersMeta = data?.containers || [];

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

      containersMeta.forEach((c) => {
        const cCpu = m.dockerCpuPercent * (c.cpuWeight ?? 0);
        const cMem = m.dockerMemUsedBytes * (c.memWeight ?? 0);
        const cNet = (m.dockerNetRxBps + m.dockerNetTxBps) * (c.netWeight ?? 0);

        dataPoint[`${c.name}_cpu`] = cCpu;
        dataPoint[`${c.name}_mem`] = cMem;
        dataPoint[`${c.name}_net`] = cNet;
      });

      dataPoint.totalCpu = m.dockerCpuPercent;
      dataPoint.totalMem = m.dockerMemUsedBytes;
      dataPoint.totalNet = m.dockerNetRxBps + m.dockerNetTxBps;

      return dataPoint;
    });
  }, [metrics, containersMeta]);

  // Extract latest metrics for the table
  const containersTableData = data?.containers || [];

  const latestMetric = metrics[metrics.length - 1];
  const latestTotalCpu = latestMetric?.dockerCpuPercent ?? 0;
  const latestTotalMem = latestMetric?.dockerMemUsedBytes ?? 0;
  const latestTotalNet = (latestMetric?.dockerNetRxBps ?? 0) + (latestMetric?.dockerNetTxBps ?? 0);

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-24 text-ink-muted card">
        <Loader2 className="mr-2 h-4 w-4 animate-spin text-brand" />
        Loading containers…
      </div>
    );
  }

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
                {containersMeta.map((c) => (
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
                {containersMeta.map((c) => (
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
              {containersMeta.map((c) => (
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
      <ContainerTable
        containers={containersTableData}
        selectedContainer={selectedContainer}
        onSelectContainer={setSelectedContainer}
      />
      {selectedContainer && (
        <ContainerDetailPanel
          container={selectedContainer}
          onClose={() => setSelectedContainer(null)}
        />
      )}
    </div>
  );
}
