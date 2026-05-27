import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Agent } from '@/lib/models/Agent';
import { ServiceMetric } from '@/lib/models/ServiceMetric';
import { getSessionFromCookies } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: { agentId: string; serviceName: string };
}

export async function GET(req: Request, { params }: RouteContext) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const range = url.searchParams.get('range') ?? '1h';

  const now = Date.now();
  let fromMs = now - 60 * 60 * 1000;
  if (range === '6h') fromMs = now - 6 * 60 * 60 * 1000;
  else if (range === '24h') fromMs = now - 24 * 60 * 60 * 1000;
  else if (range === '7d') fromMs = now - 7 * 24 * 60 * 60 * 1000;

  await connectDB();

  // Validate agent ownership
  const agentExists = await Agent.findOne({ agentId: params.agentId, userId: session.sub }).lean();
  if (!agentExists) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const rows = await ServiceMetric.find({
    agentId: params.agentId,
    serviceName: decodeURIComponent(params.serviceName),
    ts: { $gte: new Date(fromMs) },
  })
    .sort({ ts: 1 })
    .limit(1000)
    .lean();

  const metrics = rows.map((m) => ({
    ts: m.ts,
    cpuPercent: m.cpuPercent,
    memBytes: m.memBytes,
  }));

  return NextResponse.json({ metrics });
}
