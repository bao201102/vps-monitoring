'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Server, Settings, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ThemeToggle';

export function MobileNav({ role }: { role: string }) {
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: 'Servers', icon: Server },
    role === 'admin' && { href: '/admin/users', label: 'Users', icon: Users },
    { href: '/settings', label: 'Settings', icon: Settings },
  ].filter(Boolean) as { href: string; label: string; icon: any }[];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex items-stretch gap-1 border-t border-border bg-bg-soft/80 px-2 py-2 backdrop-blur-xl lg:hidden">
      <div className="flex flex-1 justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors',
                active ? 'text-ink' : 'text-ink-muted'
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </div>
      <div className="flex items-center border-l border-border pl-1">
        <ThemeToggle />
      </div>
    </nav>
  );
}
