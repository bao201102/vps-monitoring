import { NextResponse } from 'next/server';
import { z } from 'zod';
import { connectDB } from '@/lib/db';
import { AgentCommand } from '@/lib/models/AgentCommand';
import { authenticateAgent } from '@/lib/ingest';
import { isObjectId } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const commandStatusSchema = z.object({
  agentId: z.string().min(1).max(64),
  token: z.string().min(1).max(128),
  commandId: z.string().min(1),
  status: z.enum(['done', 'failed']),
  output: z.string().max(4000).optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = commandStatusSchema.safeParse(body);
  if (!parsed.success || !isObjectId(parsed.data.commandId)) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  await connectDB();

  const auth = await authenticateAgent(parsed.data.agentId, parsed.data.token);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized agent credentials' }, { status: 401 });
  }

  const command = await AgentCommand.findOneAndUpdate(
    { _id: parsed.data.commandId, agentId: parsed.data.agentId, status: 'sent' },
    { $set: { status: parsed.data.status, output: parsed.data.output ?? '' } },
    { new: true }
  );

  if (!command) {
    return NextResponse.json({ error: 'Command not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
