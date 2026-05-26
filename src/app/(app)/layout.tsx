import { redirect } from 'next/navigation';
import { getSessionFromCookies } from '@/lib/auth';
import { isSetupComplete } from '@/lib/setup';
import { MobileNav } from '@/components/MobileNav';
import { AppLayoutClient } from '@/components/AppLayoutClient';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!(await isSetupComplete())) redirect('/setup');
  const session = await getSessionFromCookies();
  if (!session) redirect('/login');

  return (
    <div className="min-h-screen flex flex-col">
      <MobileNav role={session.role} />
      <div className="flex flex-col flex-grow min-h-screen">
        <AppLayoutClient username={session.username} role={session.role}>
          {children}
        </AppLayoutClient>
      </div>
    </div>
  );
}
