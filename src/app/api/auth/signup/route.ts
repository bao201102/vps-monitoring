import { NextResponse } from 'next/server';
import { z } from 'zod';
import { connectDB } from '@/lib/db';
import { env } from '@/lib/env';
import { User } from '@/lib/models/User';
import { hashPassword, signSession, setSessionCookie } from '@/lib/auth';
import { querySetupComplete } from '@/lib/setup';
import { limitByIp } from '@/lib/http';

export const runtime = 'nodejs';

const schema = z.object({
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_.-]+$/, 'Invalid username'),
  password: z.string().min(8).max(128),
});

export async function POST(req: Request) {
  if (!env.ALLOW_SIGNUP) {
    return NextResponse.json({ error: 'Public sign-up is disabled. Ask an admin for an account.' }, { status: 403 });
  }
  const limited = limitByIp(req, 'signup', 5, 60 * 60_000);
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // The first account must go through /setup, which creates the admin.
  if (!(await querySetupComplete())) {
    return NextResponse.json({ error: 'Run the initial setup first.' }, { status: 400 });
  }

  await connectDB();
  const existingUser = await User.findOne({ username: parsed.data.username.toLowerCase() });
  if (existingUser) {
    return NextResponse.json({ error: 'Username already taken' }, { status: 400 });
  }

  const user = await User.create({
    username: parsed.data.username.toLowerCase(),
    passwordHash: await hashPassword(parsed.data.password),
    role: 'user',
  });

  await setSessionCookie(await signSession(user));

  return NextResponse.json({ ok: true, username: user.username });
}
