import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Agent } from '@/lib/models/Agent';
import { AgentCommand } from '@/lib/models/AgentCommand';
import { getSessionFromCookies } from '@/lib/auth';
import { isObjectId } from '@/lib/http';

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
  if (!isObjectId(params.commandId)) return NextResponse.json({ error: 'Command not found' }, { status: 404 });

  await connectDB();

  const owns = await Agent.exists({ agentId: params.agentId, userId: session.sub });
  if (!owns) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  const command = await AgentCommand.findOne({
    _id: params.commandId,
    agentId: params.agentId,
  }).lean();

  if (!command) {
    return NextResponse.json({ error: 'Command not found' }, { status: 404 });
  }

  return NextResponse.json({
    status: command.status,
    output: command.output ?? '',
  });
}
