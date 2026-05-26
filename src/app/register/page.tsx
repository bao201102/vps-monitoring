import { redirect } from 'next/navigation';
import { isSetupComplete } from '@/lib/setup';
import { SignupForm } from './SignupForm';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function RegisterPage() {
  if (!(await isSetupComplete())) {
    redirect('/setup');
  }

  return (
    <main className="relative min-h-screen">
      <div className="fixed right-4 top-4 z-50">
        <ThemeToggle className="bg-bg-card/90 border border-border shadow-card" />
      </div>
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-8 px-6 py-12">
        <Logo />

        <div className="card card-pad w-full animate-fade-in">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight text-ink">Create an account</h1>
            <p className="mt-1 text-sm text-ink-muted">Sign up to monitor your VPS fleet.</p>
          </div>
          <SignupForm />

          <p className="mt-6 text-center text-xs text-ink-soft">
            Already have an account?{' '}
            <Link href="/login" className="text-brand hover:underline font-semibold">
              Sign in
            </Link>
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-ink-soft">
          <ShieldCheck className="h-3.5 w-3.5" />
          Self-hosted · Open source
        </div>
      </div>
    </main>
  );
}
