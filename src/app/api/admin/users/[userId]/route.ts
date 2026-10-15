import { NextResponse } from 'next/server';
import { z } from 'zod';
import { connectDB } from '@/lib/db';
import { User } from '@/lib/models/User';
import { Agent } from '@/lib/models/Agent';
import { Incident } from '@/lib/models/Incident';
import { hashPassword, requireAdmin } from '@/lib/auth';
import { deleteAgentsData } from '@/lib/maintenance';
import { audit } from '@/lib/audit';
import { isObjectId } from '@/lib/http';
import { invalidateResolvedSettings } from '@/lib/user-settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: { userId: string };
}

const patchSchema = z
  .object({
    role: z.enum(['admin', 'user']).optional(),
    password: z.string().min(8).max(128).optional(),
  })
  .refine((v) => v.role !== undefined || v.password !== undefined, 'Nothing to update');

/** Change role and/or reset password. Either change signs the user out everywhere. */
export async function PATCH(req: Request, { params }: RouteContext) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!isObjectId(params.userId)) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  await connectDB();
  const user = await User.findById(params.userId);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  if (parsed.data.role && parsed.data.role !== user.role) {
    if (params.userId === session.sub) {
      return NextResponse.json({ error: 'You cannot change your own role' }, { status: 400 });
    }
    if (user.role === 'admin' && (await User.countDocuments({ role: 'admin' })) <= 1) {
      return NextResponse.json({ error: 'At least one admin must remain' }, { status: 400 });
    }
    user.role = parsed.data.role;
  }
  if (parsed.data.password) {
    user.passwordHash = await hashPassword(parsed.data.password);
  }
  user.sessionVersion = (user.sessionVersion ?? 0) + 1;
  await user.save();

  await audit(session, 'user.update', params.userId, {
    username: user.username,
    role: parsed.data.role,
    passwordReset: Boolean(parsed.data.password),
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (params.userId === session.sub) {
    return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 });
  }
  if (!isObjectId(params.userId)) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  await connectDB();

  const user = await User.findById(params.userId);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const agents = await Agent.find({ userId: params.userId }).select('agentId').lean();
  await deleteAgentsData(agents.map((a) => a.agentId));
  await Incident.deleteMany({ userId: params.userId });
  await User.deleteOne({ _id: params.userId });
  invalidateResolvedSettings(params.userId);

  await audit(session, 'user.delete', params.userId, { username: user.username, agents: agents.length });
  return NextResponse.json({ ok: true });
}
