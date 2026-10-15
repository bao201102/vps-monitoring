import { NextResponse } from 'next/server';
import { z } from 'zod';
import { connectDB } from '@/lib/db';
import { User } from '@/lib/models/User';
import { Agent } from '@/lib/models/Agent';
import { hashPassword, requireAdmin } from '@/lib/auth';
import { audit } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await connectDB();
  const [users, counts] = await Promise.all([
    User.find({}).select('username role createdAt').sort({ createdAt: -1 }).lean(),
    Agent.aggregate<{ _id: unknown; n: number }>([{ $group: { _id: '$userId', n: { $sum: 1 } } }]),
  ]);
  const byUser = new Map(counts.map((c) => [String(c._id), c.n]));

  return NextResponse.json({
    users: users.map((u) => ({
      id: u._id.toString(),
      username: u.username,
      role: u.role,
      createdAt: u.createdAt,
      vpsCount: byUser.get(u._id.toString()) ?? 0,
    })),
  });
}

const createSchema = z.object({
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_.-]+$/, 'Invalid username'),
  password: z.string().min(8).max(128),
  role: z.enum(['admin', 'user']).default('user'),
});

export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  await connectDB();
  const username = parsed.data.username.toLowerCase();
  if (await User.exists({ username })) {
    return NextResponse.json({ error: 'Username already taken' }, { status: 400 });
  }
  const user = await User.create({
    username,
    passwordHash: await hashPassword(parsed.data.password),
    role: parsed.data.role,
  });
  await audit(session, 'user.create', user._id.toString(), { username, role: parsed.data.role });
  return NextResponse.json({ ok: true, id: user._id.toString() });
}
