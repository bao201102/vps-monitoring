import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { AuditLog } from '@/lib/models/AuditLog';
import { requireAdmin } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const limit = Math.min(500, Math.max(1, Number(new URL(req.url).searchParams.get('limit')) || 200));
  await connectDB();
  const rows = await AuditLog.find({}).sort({ ts: -1 }).limit(limit).lean();
  return NextResponse.json({
    entries: rows.map((r) => ({
      id: String(r._id),
      ts: r.ts,
      username: r.username,
      action: r.action,
      target: r.target,
      meta: r.meta ?? null,
    })),
  });
}
