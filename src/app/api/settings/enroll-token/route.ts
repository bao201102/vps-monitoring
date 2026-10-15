import { NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { rotateEnrollToken } from '@/lib/enroll';
import { audit } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Rotate the enrollment token. Existing agents keep working; old install commands stop. */
export async function POST() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const enrollToken = await rotateEnrollToken(session.sub);
  await audit(session, 'enroll_token.rotate', session.sub);
  return NextResponse.json({ ok: true, enrollToken });
}
