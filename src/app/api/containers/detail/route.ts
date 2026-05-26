import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Agent } from '@/lib/models/Agent';
import { DockerContainer } from '@/lib/models/DockerContainer';
import { getSessionFromCookies } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const name = searchParams.get('name');
  const agentId = searchParams.get('agentId');
  const system = searchParams.get('system'); // fallback if agentId is missing

  if (!name) {
    return NextResponse.json({ error: 'Missing name parameter' }, { status: 400 });
  }

  await connectDB();

  let container = null;

  if (agentId) {
    // Find container by exact agentId and name
    container = await DockerContainer.findOne({ agentId, name }).lean();
  } else if (system) {
    // Fallback: Find matching agent by label or hostname, then container
    const agent = await Agent.findOne({
      userId: session.sub,
      $or: [
        { label: system },
        { hostname: system }
      ]
    }).lean();

    if (agent) {
      container = await DockerContainer.findOne({ agentId: agent.agentId, name }).lean();
    }
  }

  // If still not found, try finding any container with that name belonging to one of the user's agents
  if (!container) {
    const agents = await Agent.find({ userId: session.sub }).lean();
    const agentIds = agents.map((a) => a.agentId);
    container = await DockerContainer.findOne({ agentId: { $in: agentIds }, name }).lean();
  }

  if (!container) {
    return NextResponse.json({ error: 'Container not found' }, { status: 404 });
  }

  return NextResponse.json({
    name: container.name,
    logs: container.logs,
    details: container.details
  });
}
