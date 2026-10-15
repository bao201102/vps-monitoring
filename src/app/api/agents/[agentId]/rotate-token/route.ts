import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { connectDB } from '@/lib/db';
import { Agent } from '@/lib/models/Agent';
import { getSessionFromCookies } from '@/lib/auth';
import { audit } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: { agentId: string };
}

/**
 * Issue a new agent token. The agent receives it in the next heartbeat response,
 * stores it, and the old token stops working as soon as the new one is used.
 */
export async function POST(_req: Request, { params }: RouteContext) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();
  const res = await Agent.updateOne(
    { agentId: params.agentId, userId: session.sub },
    { $set: { nextToken: `tok_${nanoid(40)}` } }
  );
  if (!res.matchedCount) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await audit(session, 'agent.rotate_token', params.agentId);
  return NextResponse.json({ ok: true });
}
