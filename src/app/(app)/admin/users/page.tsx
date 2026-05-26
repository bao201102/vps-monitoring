import { redirect } from 'next/navigation';
import { getSessionFromCookies } from '@/lib/auth';
import { UsersAdminClient } from './UsersAdminClient';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const session = await getSessionFromCookies();
  if (!session || session.role !== 'admin') {
    redirect('/dashboard');
  }

  return <UsersAdminClient currentUserId={session.sub} />;
}
