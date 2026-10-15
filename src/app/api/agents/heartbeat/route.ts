import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { authenticateAgent, heartbeatSchema, processHeartbeat } from '@/lib/ingest';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = heartbeatSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  // The agent reports every >= 5s; anything faster is a misconfigured or abusive client.
  if (!rateLimit(`hb:${parsed.data.agentId}`, 30, 60_000).ok) {
    return NextResponse.json({ error: 'Too many heartbeats' }, { status: 429 });
  }

  await connectDB();
  const auth = await authenticateAgent(parsed.data.agentId, parsed.data.token);
  if (!auth) {
    return NextResponse.json({ error: 'Unknown agent or invalid token' }, { status: 401 });
  }

  try {
    const result = await processHeartbeat(auth.agent, auth.usedNext, parsed.data);
    return NextResponse.json(result);
  } catch (e) {
    console.error('[heartbeat]', parsed.data.agentId, e);
    return NextResponse.json({ error: 'Failed to process heartbeat' }, { status: 500 });
  }
}
