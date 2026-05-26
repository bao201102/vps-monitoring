import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { User } from '@/lib/models/User';
import { Agent } from '@/lib/models/Agent';
import { Metric } from '@/lib/models/Metric';
import { getSessionFromCookies } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: { userId: string };
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (params.userId === session.sub) {
    return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 });
  }

  await connectDB();

  const user = await User.findById(params.userId);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const agents = await Agent.find({ userId: params.userId }).lean();
  const agentIds = agents.map((a) => a.agentId);

  // Delete all metrics of the user's servers
  if (agentIds.length > 0) {
    await Metric.deleteMany({ agentId: { $in: agentIds } });
  }

  // Delete all agents of the user
  await Agent.deleteMany({ userId: params.userId });

  // Delete the user themselves
  await User.deleteOne({ _id: params.userId });

  return NextResponse.json({ ok: true });
}
