import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { User } from '@/lib/models/User';
import { Agent } from '@/lib/models/Agent';
import { getSessionFromCookies } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await connectDB();
  const users = await User.find({}).sort({ createdAt: -1 }).lean();

  const data = await Promise.all(
    users.map(async (u) => {
      const vpsCount = await Agent.countDocuments({ userId: u._id });
      return {
        id: u._id.toString(),
        username: u.username,
        role: u.role,
        createdAt: u.createdAt,
        vpsCount,
      };
    })
  );

  return NextResponse.json({ users: data });
}
