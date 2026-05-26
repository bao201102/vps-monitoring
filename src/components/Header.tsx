'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Search,
  Plus,
  Settings,
  Check,
  User,
  LogOut,
  Users,
  BookOpen,
  Container,
} from 'lucide-react';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';
import { toast } from 'sonner';

interface HeaderProps {
  onSearchClick: () => void;
  username: string;
  role: string;
}

export function Header({ onSearchClick, username, role }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMac, setIsMac] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Detect macOS for Kbd shortcut display
  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      setIsMac(navigator.platform.toUpperCase().indexOf('MAC') >= 0);
    }
  }, []);

  // Handle click outside user menu dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    toast.success('Signed out');
    router.push('/login');
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-bg-soft/60 backdrop-blur-xl shadow-sm">
      <div className="mx-auto w-full max-w-[90%] flex h-14 items-center justify-between px-4 lg:px-6">
        {/* Left side: Logo and Search Trigger */}
        <div className="flex items-center gap-4 grow">
          {/* Always visible Logo */}
          <Link href="/">
            <Logo className="scale-95 origin-left shrink-0" />
          </Link>

          {/* Search Trigger Button */}
          <button
            onClick={onSearchClick}
            className="flex items-center gap-2.5 rounded-lg border border-border bg-bg-soft/50 hover:bg-bg-muted/80 text-ink-muted hover:text-ink px-3 py-1.5 w-36 sm:w-56 md:w-64 lg:w-72 transition-all text-left text-sm outline-none cursor-pointer shadow-sm select-none ml-2 shrink-0 animate-fade-in"
            title="Search (Ctrl + K)"
          >
            <Search className="h-4 w-4 shrink-0 text-ink-soft" />
            <span className="text-sm font-medium grow text-ink-soft truncate">
              Search...
            </span>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-border bg-bg px-1.5 py-0.5 text-xs font-mono font-medium text-[#64748b] select-none">
              {isMac ? '⌘' : 'Ctrl'} K
            </kbd>
          </button>
        </div>

        {/* Right side: Utilities and Add Server */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Users Management Icon (Admin only) */}
          {role === 'admin' && (
            <Link
              href="/admin/users"
              className={`rounded-md p-2 text-ink-soft transition-colors hover:bg-bg-muted hover:text-ink ${pathname.startsWith('/admin/users') ? 'bg-bg-muted text-ink' : ''
                }`}
              title="Users Management"
            >
              <Users className="h-4 w-4" />
            </Link>
          )}

          {/* All Containers Icon */}
          <Link
            href="/containers"
            className={`rounded-md p-2 text-ink-soft transition-colors hover:bg-bg-muted hover:text-ink ${pathname === '/containers' ? 'bg-bg-muted text-ink' : ''
              }`}
            title="All Containers"
          >
            <Container className="h-4 w-4" />
          </Link>

          {/* Documentation Icon */}
          <Link
            href="/docs"
            className={`rounded-md p-2 text-ink-soft transition-colors hover:bg-bg-muted hover:text-ink ${pathname === '/docs' ? 'bg-bg-muted text-ink' : ''
              }`}
            title="Documentation"
          >
            <BookOpen className="h-4 w-4" />
          </Link>





          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Settings Icon */}
          <Link
            href="/settings"
            className={`rounded-md p-2 text-ink-soft transition-colors hover:bg-bg-muted hover:text-ink ${pathname === '/settings' ? 'bg-bg-muted text-ink' : ''
              }`}
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </Link>

          {/* User Account Profile with Dropdown */}
          <div ref={userMenuRef} className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex h-8 w-8 rounded-full border border-border bg-bg-soft hover:bg-bg-muted text-ink-muted hover:text-ink items-center justify-center font-bold text-xs select-none shadow-sm cursor-pointer transition-colors"
              title={`Logged in as ${username} (${role})`}
            >
              {username ? (
                username.charAt(0).toUpperCase()
              ) : (
                <User className="h-3.5 w-3.5" />
              )}
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 mt-2.5 w-48 rounded-xl border border-border bg-bg-soft p-1.5 shadow-2xl z-30">
                <div className="px-3 py-2 border-b border-border mb-1.5">
                  <div className="font-semibold text-ink text-xs truncate">{username}</div>
                  <div className="text-[10px] text-ink-soft uppercase tracking-wider">
                    {role === 'admin' ? 'Administrator' : 'User'}
                  </div>
                </div>
                <button
                  onClick={logout}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-danger hover:bg-red-950/20 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out
                </button>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="hidden xs:block h-6 w-px bg-border mx-1" />

          {/* Add Server Button */}
          <Link
            href="/servers/add"
            className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5 font-semibold shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden xs:inline">Add Server</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
