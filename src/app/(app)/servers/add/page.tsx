import { redirect } from 'next/navigation';
import { AddServerClient } from './AddServerClient';
import { env } from '@/lib/env';
import { getSessionFromCookies } from '@/lib/auth';
import { getOrCreateEnrollToken } from '@/lib/enroll';

export const dynamic = 'force-dynamic';

export default async function AddServerPage() {
  const session = await getSessionFromCookies();
  if (!session) redirect('/login');
  const enrollToken = await getOrCreateEnrollToken(session.sub);
  return <AddServerClient appUrl={env.APP_URL} userId={session.sub} enrollToken={enrollToken} />;
}
