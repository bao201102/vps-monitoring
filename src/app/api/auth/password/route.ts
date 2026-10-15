import { NextResponse } from 'next/server';
import { z } from 'zod';
import { connectDB } from '@/lib/db';
import { User } from '@/lib/models/User';
import {
  getSessionFromCookies,
  hashPassword,
  setSessionCookie,
  signSession,
  verifyPassword,
} from '@/lib/auth';
import { limitByIp } from '@/lib/http';

export const runtime = 'nodejs';

const schema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const limited = limitByIp(req, 'password', 10, 15 * 60_000);
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  await connectDB();
  const user = await User.findById(session.sub);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const ok = await verifyPassword(parsed.data.oldPassword, user.passwordHash);
  if (!ok) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });

  user.passwordHash = await hashPassword(parsed.data.newPassword);
  // Log out every other session; keep this browser signed in with a fresh token.
  user.sessionVersion = (user.sessionVersion ?? 0) + 1;
  await user.save();
  await setSessionCookie(await signSession(user));

  return NextResponse.json({ ok: true });
}
