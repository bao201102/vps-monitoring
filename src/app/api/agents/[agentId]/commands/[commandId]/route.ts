import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Agent } from '@/lib/models/Agent';
import { AgentCommand } from '@/lib/models/AgentCommand';
import { getSessionFromCookies } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: {
    agentId: string;
    commandId: string;
  };
}

export async function GET(_req: Request, { params }: RouteContext) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();

  // Validate agent ownership
  const agent = await Agent.findOne({ agentId: params.agentId, userId: session.sub }).lean();
  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  // Find the command
  const command = await AgentCommand.findOne({
    _id: params.commandId,
    agentId: params.agentId,
  }).lean();

  if (!command) {
    return NextResponse.json({ error: 'Command not found' }, { status: 404 });
  }

  return NextResponse.json({
    status: command.status,
  });
}
