'use client';

import React, { useState, useEffect } from 'react';
import { Header } from './Header';
import { CommandPalette } from './CommandPalette';

interface AppLayoutClientProps {
  username: string;
  role: string;
  children: React.ReactNode;
}

export function AppLayoutClient({ username, role, children }: AppLayoutClientProps) {
  const [searchOpen, setSearchOpen] = useState(false);

  // Global keyboard listener for Ctrl + K or Cmd + K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if Ctrl or Cmd is pressed along with 'k' or 'K'
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <>
      <Header
        onSearchClick={() => setSearchOpen(true)}
        username={username}
        role={role}
      />
      <main className="mx-auto w-full max-w-[90%] px-4 pb-24 pt-6 sm:px-6 lg:pb-10 lg:pt-8 flex-grow">
        {children}
      </main>
      <CommandPalette
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        role={role}
      />
    </>
  );
}
