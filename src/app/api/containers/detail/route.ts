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

  if (!name || !agentId) {
    return NextResponse.json({ error: 'Missing name or agentId parameter' }, { status: 400 });
  }

  await connectDB();

  // Ownership check: the container must belong to one of the caller's agents.
  const owns = await Agent.exists({ agentId, userId: session.sub });
  if (!owns) {
    return NextResponse.json({ error: 'Container not found' }, { status: 404 });
  }

  const container = await DockerContainer.findOne({ agentId, name }).lean();
  if (!container) {
    return NextResponse.json({ error: 'Container not found' }, { status: 404 });
  }

  return NextResponse.json({
    name: container.name,
    logs: container.logs,
    details: container.details,
  });
}
