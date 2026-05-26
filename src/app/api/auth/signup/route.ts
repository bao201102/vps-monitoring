import { NextResponse } from 'next/server';
import { z } from 'zod';
import { connectDB } from '@/lib/db';
import { User } from '@/lib/models/User';
import { hashPassword, signSession, setSessionCookie } from '@/lib/auth';

export const runtime = 'nodejs';

const schema = z.object({
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_.-]+$/, 'Invalid username'),
  password: z.string().min(8).max(128),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  await connectDB();
  const existingUser = await User.findOne({ username: parsed.data.username.toLowerCase() });
  if (existingUser) {
    return NextResponse.json({ error: 'Username already taken' }, { status: 400 });
  }

  // First user created will be the admin, subsequent ones will be regular users
  const count = await User.countDocuments({});
  const role = count === 0 ? 'admin' : 'user';

  const passwordHash = await hashPassword(parsed.data.password);
  const user = await User.create({
    username: parsed.data.username.toLowerCase(),
    passwordHash,
    role,
  });

  const token = await signSession({
    sub: user._id.toString(),
    username: user.username,
    role,
  });
  await setSessionCookie(token);

  return NextResponse.json({ ok: true, username: user.username });
}
