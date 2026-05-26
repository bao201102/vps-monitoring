import { NextResponse } from 'next/server';
import { z } from 'zod';
import { connectDB } from '@/lib/db';
import { Agent } from '@/lib/models/Agent';
import { AgentCommand } from '@/lib/models/AgentCommand';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const commandStatusSchema = z.object({
  agentId: z.string().min(1),
  token: z.string().min(1),
  commandId: z.string().min(1),
  status: z.enum(['done', 'failed']),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = commandStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  await connectDB();

  // Validate agent credentials
  const agent = await Agent.findOne({
    agentId: parsed.data.agentId,
    token: parsed.data.token,
  }).lean();

  if (!agent) {
    return NextResponse.json({ error: 'Unauthorized agent credentials' }, { status: 401 });
  }

  // Update command status
  const command = await AgentCommand.findOneAndUpdate(
    { _id: parsed.data.commandId, agentId: parsed.data.agentId },
    { $set: { status: parsed.data.status } },
    { new: true }
  );

  if (!command) {
    return NextResponse.json({ error: 'Command not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
