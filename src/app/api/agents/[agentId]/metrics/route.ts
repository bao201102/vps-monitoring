import { NextResponse } from 'next/server';
import type { PipelineStage } from 'mongoose';
import { connectDB } from '@/lib/db';
import { env } from '@/lib/env';
import { Metric, METRIC_AVG_FIELDS, METRIC_LAST_FIELDS } from '@/lib/models/Metric';
import { MetricHourly } from '@/lib/models/MetricHourly';
import { Agent } from '@/lib/models/Agent';
import { getSessionFromCookies } from '@/lib/auth';
import { bucketExpr, parseRange, RANGES } from '@/lib/ranges';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: { agentId: string };
}

export async function GET(req: Request, { params }: RouteContext) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const range = parseRange(new URL(req.url).searchParams.get('range'));
  const { ms, bucketMs } = RANGES[range];
  const from = new Date(Date.now() - ms);

  await connectDB();
  const agentExists = await Agent.exists({ agentId: params.agentId, userId: session.sub });
  if (!agentExists) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Raw samples only live for METRICS_RETENTION_DAYS; longer ranges read the hourly rollup.
  const useRollup = ms > env.METRICS_RETENTION_DAYS * 86_400_000;
  const group: Record<string, unknown> = { _id: bucketExpr(bucketMs) };
  for (const f of METRIC_AVG_FIELDS) group[f] = { $avg: `$${f}` };
  for (const f of METRIC_LAST_FIELDS) group[f] = { $last: `$${f}` };

  const pipeline: PipelineStage[] = [
    { $match: { agentId: params.agentId, ts: { $gte: from } } },
    { $sort: { ts: 1 } },
    { $group: group as PipelineStage.Group['$group'] },
    { $sort: { _id: 1 } },
  ];
  const rows = useRollup ? await MetricHourly.aggregate(pipeline) : await Metric.aggregate(pipeline);

  const metrics = rows.map((m) => {
    const out: Record<string, unknown> = { ts: m._id };
    for (const f of METRIC_AVG_FIELDS) out[f] = m[f] ?? 0;
    for (const f of METRIC_LAST_FIELDS) out[f] = m[f] ?? (f === 'temperatures' ? {} : 0);
    return out;
  });

  return NextResponse.json({ metrics, source: useRollup ? 'hourly' : 'raw' });
}
