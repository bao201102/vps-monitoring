import { AddServerClient } from './AddServerClient';
import { env } from '@/lib/env';
import { getSessionFromCookies } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AddServerPage() {
  const session = await getSessionFromCookies();
  const userId = session?.sub ?? '';
  return <AddServerClient appUrl={env.APP_URL} userId={userId} />;
}
