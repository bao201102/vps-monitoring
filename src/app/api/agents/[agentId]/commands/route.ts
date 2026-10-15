import { NextResponse } from 'next/server';
import { z } from 'zod';
import { connectDB } from '@/lib/db';
import { Agent } from '@/lib/models/Agent';
import { AgentCommand, COMMAND_ACTIONS, COMMAND_KINDS, COMMAND_TARGET_RE } from '@/lib/models/AgentCommand';
import { getSessionFromCookies } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: { agentId: string };
}

/** Commands not picked up within this window are expired by the scheduler. */
const COMMAND_TTL_MS = 2 * 60_000;

const createSchema = z
  .object({
    kind: z.enum(COMMAND_KINDS),
    action: z.string(),
    target: z.string().max(128).default(''),
  })
  .refine((c) => COMMAND_ACTIONS[c.kind].includes(c.action), 'Unsupported action')
  .refine((c) => (c.kind === 'agent' ? c.target === '' : COMMAND_TARGET_RE.test(c.target)), 'Invalid target')
  .refine((c) => !c.target.startsWith('vps-monitor-agent'), 'Cannot control the monitoring agent service');

export async function GET(_req: Request, { params }: RouteContext) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();
  const owns = await Agent.exists({ agentId: params.agentId, userId: session.sub });
  if (!owns) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const commands = await AgentCommand.find({ agentId: params.agentId }).sort({ createdAt: -1 }).limit(50).lean();
  return NextResponse.json({
    commands: commands.map((c) => ({
      id: String(c._id),
      kind: c.kind,
      action: c.action,
      target: c.target,
      status: c.status,
      output: c.output,
      requestedBy: c.requestedBy,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    })),
  });
}

export async function POST(req: Request, { params }: RouteContext) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!rateLimit(`cmd:${session.sub}`, 20, 60_000).ok) {
    return NextResponse.json({ error: 'Too many commands, slow down.' }, { status: 429 });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  await connectDB();
  const agent = await Agent.findOne({ agentId: params.agentId, userId: session.sub }).select('remoteCommands').lean();
  if (!agent) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!agent.remoteCommands) {
    return NextResponse.json(
      {
        error:
          'Remote control is disabled on this server. Set ALLOW_REMOTE_COMMANDS=1 in agent.conf (or reinstall with "Allow remote control") and restart the agent.',
      },
      { status: 409 }
    );
  }

  const cmd = await AgentCommand.create({
    agentId: params.agentId,
    kind: parsed.data.kind,
    action: parsed.data.action,
    target: parsed.data.target,
    status: 'pending',
    requestedBy: session.username,
    expiresAt: new Date(Date.now() + COMMAND_TTL_MS),
  });
  await audit(session, `command.${parsed.data.kind}.${parsed.data.action}`, params.agentId, {
    target: parsed.data.target,
    commandId: String(cmd._id),
  });

  return NextResponse.json({ ok: true, id: String(cmd._id) });
}
