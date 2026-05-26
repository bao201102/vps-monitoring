import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Agent } from '@/lib/models/Agent';
import { Metric } from '@/lib/models/Metric';
import { DockerContainer } from '@/lib/models/DockerContainer';
import { getSessionFromCookies } from '@/lib/auth';
import { format } from 'date-fns';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const agentIdParam = searchParams.get('agentId');

  await connectDB();

  // Find all agents for the current user (optionally filtered by agentId)
  const agentQuery: Record<string, any> = { userId: session.sub };
  if (agentIdParam) {
    agentQuery.agentId = agentIdParam;
  }
  const agents = await Agent.find(agentQuery).lean();
  const agentIds = agents.map((a) => a.agentId);

  // Fetch the latest metrics for these agents
  const latestMetrics = await Metric.aggregate([
    { $match: { agentId: { $in: agentIds } } },
    { $sort: { ts: -1 } },
    { $group: { _id: '$agentId', metric: { $first: '$$ROOT' } } },
  ]);

  const latestMap = new Map<string, (typeof latestMetrics)[number]['metric']>();
  for (const item of latestMetrics) {
    latestMap.set(item._id, item.metric);
  }

  // Fetch all container configurations for these agents from the DB
  const dbContainers = await DockerContainer.find({ agentId: { $in: agentIds } }).lean();

  // Interpolate metrics
  const containers = dbContainers.map((c) => {
    const agent = agents.find((a) => a.agentId === c.agentId);
    const m = latestMap.get(c.agentId);
    
    const hasMetric = m && (m.dockerCpuPercent > 0 || m.dockerMemUsedBytes > 0);
    const updatedTime = m?.ts
      ? format(new Date(m.ts), 'h:mm:ss a')
      : format(new Date(), 'h:mm:ss a');

    return {
      name: c.name,
      system: agent ? (agent.label || agent.hostname) : 'unknown',
      agentId: c.agentId,
      image: c.image,
      ports: c.ports,
      status: c.status,
      health: c.health,
      cpu: hasMetric ? m.dockerCpuPercent * c.cpuWeight : c.defaultCpu,
      memory: hasMetric ? m.dockerMemUsedBytes * c.memWeight : c.defaultMem,
      net: hasMetric ? (m.dockerNetRxBps + m.dockerNetTxBps) * c.netWeight : c.defaultNet,
      updated: updatedTime,
      cpuWeight: c.cpuWeight,
      memWeight: c.memWeight,
      netWeight: c.netWeight,
      color: c.color,
    };
  });

  return NextResponse.json({ containers });
}
