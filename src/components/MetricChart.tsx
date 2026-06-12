'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { format } from 'date-fns';

interface SeriesConfig {
  key: string;
  label: string;
  color: string;
  formatter?: (v: number) => string;
}

interface Props {
  data: ReadonlyArray<unknown>;
  series: SeriesConfig[];
  yFormatter?: (v: number) => string;
  domain?: [number | 'auto', number | 'auto'];
  height?: number;
}

export function MetricChart({ data, series, yFormatter, domain, height = 220 }: Props) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart
        data={data as ReadonlyArray<Record<string, unknown>> as unknown as Array<Record<string, unknown>>}
        margin={{ top: 8, right: 8, left: -10, bottom: 0 }}
      >
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={s.color} stopOpacity={0.2} />
              <stop offset="95%" stopColor={s.color} stopOpacity={0.0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid stroke="rgba(var(--chart-grid), 0.4)" strokeDasharray="3 6" vertical={false} />
        <XAxis
          dataKey="ts"
          tickFormatter={(v) => format(new Date(v), 'HH:mm')}
          stroke="rgb(var(--chart-axis) / 1)"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          minTickGap={32}
        />
        <YAxis
          stroke="rgb(var(--chart-axis) / 1)"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={56}
          tickFormatter={yFormatter}
          domain={domain ?? [0, 'auto']}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'rgba(var(--chart-tooltip-bg), 0.8)',
            backdropFilter: 'blur(12px)',
            borderColor: 'rgba(var(--color-border), 0.6)',
            borderRadius: '14px',
            padding: '10px 14px',
            fontSize: 12,
            color: 'rgb(var(--chart-tooltip-fg) / 1)',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
            border: '1px solid rgba(var(--color-border), 0.4)',
          }}
          labelFormatter={(v) => format(new Date(v as string), 'PP HH:mm:ss')}
          formatter={(value, name) => {
            const s = series.find((x) => x.label === name || x.key === name);
            const formatted = s?.formatter ? s.formatter(Number(value)) : value;
            return [formatted, s?.label ?? name];
          }}
        />
        {series.map((s) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={2}
            fill={`url(#g-${s.key})`}
            isAnimationActive={true}
            animationDuration={600}
            animationEasing="ease-out"
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
