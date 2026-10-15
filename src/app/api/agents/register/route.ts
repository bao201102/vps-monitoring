import { NextResponse } from 'next/server';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { connectDB } from '@/lib/db';
import { Agent } from '@/lib/models/Agent';
import { findUserByEnrollToken } from '@/lib/enroll';
import { limitByIp } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  agentId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/).optional(),
  enrollToken: z.string().min(1).max(128),
  hostname: z.string().max(255).default('unknown'),
  os: z.string().max(64).default('unknown'),
  osVersion: z.string().max(128).default(''),
  kernel: z.string().max(128).default(''),
  arch: z.string().max(32).default(''),
  cpuModel: z.string().max(255).default(''),
  cpuCores: z.number().int().min(0).max(4096).default(0),
  totalMemoryBytes: z.number().min(0).default(0),
  totalDiskBytes: z.number().min(0).default(0),
  publicIp: z.string().max(64).optional(),
  privateIp: z.string().max(64).optional(),
  agentVersion: z.string().max(32).optional(),
});

export async function POST(req: Request) {
  const limited = limitByIp(req, 'register', 20, 10 * 60_000);
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  await connectDB();
  const owner = await findUserByEnrollToken(parsed.data.enrollToken);
  if (!owner) {
    return NextResponse.json({ error: 'Invalid enrollment token' }, { status: 401 });
  }
  const userId = String(owner._id);

  const { enrollToken: _ignored, agentId: requestedId, ...info } = parsed.data;

  let agent = requestedId ? await Agent.findOne({ agentId: requestedId }) : null;

  if (agent) {
    // Re-install on the same machine: only the owner may take over the existing record.
    if (agent.userId.toString() !== userId) {
      return NextResponse.json({ error: 'Agent belongs to another account' }, { status: 403 });
    }
    Object.assign(agent, info);
    await agent.save();
    return NextResponse.json({ ok: true, agentId: agent.agentId, token: agent.token, reused: true });
  }

  const agentId = requestedId ?? `vps_${nanoid(16)}`;
  const token = `tok_${nanoid(40)}`;

  agent = await Agent.create({
    ...info,
    agentId,
    userId,
    token,
    registeredAt: new Date(),
  });

  return NextResponse.json({ ok: true, agentId: agent.agentId, token: agent.token, reused: false });
}
