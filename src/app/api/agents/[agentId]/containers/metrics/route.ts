import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { env } from '@/lib/env';
import { Agent } from '@/lib/models/Agent';
import { ContainerMetric } from '@/lib/models/ContainerMetric';
import { getSessionFromCookies } from '@/lib/auth';
import { bucketExpr, parseRange, RANGES } from '@/lib/ranges';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: { agentId: string };
}

/**
 * Per-container history, bucketed for charts. Returns one row per bucket:
 * `{ ts, series: { [container]: { cpu, mem, net } } }`.
 */
export async function GET(req: Request, { params }: RouteContext) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const range = parseRange(new URL(req.url).searchParams.get('range'));
  // Container history is only kept as raw samples.
  const ms = Math.min(RANGES[range].ms, env.METRICS_RETENTION_DAYS * 86_400_000);
  const { bucketMs } = RANGES[range];

  await connectDB();
  const owns = await Agent.exists({ agentId: params.agentId, userId: session.sub });
  if (!owns) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const rows = await ContainerMetric.aggregate<{
    _id: { ts: Date; name: string };
    cpu: number;
    mem: number;
    net: number;
  }>([
    { $match: { agentId: params.agentId, ts: { $gte: new Date(Date.now() - ms) } } },
    {
      $group: {
        _id: { ts: bucketExpr(bucketMs), name: '$name' },
        cpu: { $avg: '$cpuPercent' },
        mem: { $avg: '$memUsedBytes' },
        net: { $avg: { $add: ['$netRxBps', '$netTxBps'] } },
      },
    },
    { $sort: { '_id.ts': 1 } },
  ]);

  const byTs = new Map<number, { ts: Date; series: Record<string, { cpu: number; mem: number; net: number }> }>();
  for (const r of rows) {
    const k = new Date(r._id.ts).getTime();
    let point = byTs.get(k);
    if (!point) {
      point = { ts: r._id.ts, series: {} };
      byTs.set(k, point);
    }
    point.series[r._id.name] = { cpu: r.cpu ?? 0, mem: r.mem ?? 0, net: r.net ?? 0 };
  }

  return NextResponse.json({ points: Array.from(byTs.values()) });
}
