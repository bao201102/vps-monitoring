import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Agent } from '@/lib/models/Agent';
import { Incident } from '@/lib/models/Incident';
import { getSessionFromCookies } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/incidents?status=open|resolved|all&agentId=…&limit=… */
export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const status = url.searchParams.get('status') ?? 'all';
  const agentId = url.searchParams.get('agentId');
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit')) || 200));

  await connectDB();
  const q: Record<string, unknown> = { userId: session.sub };
  if (status === 'open' || status === 'resolved') q.status = status;
  if (agentId) q.agentId = agentId;

  const [incidents, agents] = await Promise.all([
    Incident.find(q).sort({ status: -1, startedAt: -1 }).limit(limit).lean(),
    Agent.find({ userId: session.sub }).select('agentId hostname label').lean(),
  ]);
  const names = new Map(agents.map((a) => [a.agentId, a.label || a.hostname]));

  return NextResponse.json({
    incidents: incidents.map((i) => ({
      id: String(i._id),
      agentId: i.agentId,
      server: names.get(i.agentId) ?? i.agentId,
      type: i.type,
      key: i.key,
      status: i.status,
      severity: i.severity,
      title: i.title,
      detail: i.detail,
      startedAt: i.startedAt,
      resolvedAt: i.resolvedAt,
      notified: Boolean(i.notifiedAt),
    })),
  });
}
