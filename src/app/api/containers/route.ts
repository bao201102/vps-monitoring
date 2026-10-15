import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Agent } from '@/lib/models/Agent';
import { DockerContainer } from '@/lib/models/DockerContainer';
import { getSessionFromCookies } from '@/lib/auth';
import { colorFor } from '@/lib/colors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const agentIdParam = new URL(req.url).searchParams.get('agentId');

  await connectDB();

  const agentQuery: Record<string, unknown> = { userId: session.sub };
  if (agentIdParam) agentQuery.agentId = agentIdParam;
  const agents = await Agent.find(agentQuery).select('agentId hostname label remoteCommands').lean();
  const byId = new Map(agents.map((a) => [a.agentId, a]));

  const dbContainers = await DockerContainer.find({ agentId: { $in: Array.from(byId.keys()) } })
    .select('-logs -details')
    .sort({ name: 1 })
    .lean();

  const containers = dbContainers.map((c) => {
    const agent = byId.get(c.agentId);
    return {
      name: c.name,
      containerId: c.containerId || null,
      system: agent ? agent.label || agent.hostname : 'unknown',
      agentId: c.agentId,
      remoteCommands: Boolean(agent?.remoteCommands),
      image: c.image,
      ports: c.ports,
      status: c.status,
      health: c.health,
      cpu: c.cpuPercent ?? 0,
      memory: c.memUsedBytes ?? 0,
      net: (c.netRxBps ?? 0) + (c.netTxBps ?? 0),
      updated: (c.updatedAt ?? new Date()).toISOString(),
      color: colorFor(c.name),
    };
  });

  return NextResponse.json({ containers });
}
