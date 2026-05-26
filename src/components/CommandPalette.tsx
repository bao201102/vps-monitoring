'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import {
  Search,
  X,
  Server as ServerIcon,
  BookOpen,
  LayoutGrid,
  Settings,
  Users,
  CornerDownLeft,
  Plus,
} from 'lucide-react';
import { ServerListItem } from './servers/ServerTableView';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  role?: string;
}

interface PaletteItem {
  id: string;
  type: 'server' | 'page';
  label: string;
  subLabel?: string;
  icon: React.ComponentType<{ className?: string }>;
  url: string;
  category: 'Systems / Servers' | 'Pages / Settings';
}

export function CommandPalette({ isOpen, onClose, role }: CommandPaletteProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch servers list using SWR to share cache
  const { data } = useSWR<{ agents: ServerListItem[] }>('/api/agents', fetcher);

  // Auto-focus input when palette opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Handle click outside modal to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Define static pages and settings links
  const pageItems = useMemo((): PaletteItem[] => {
    const items: PaletteItem[] = [
      {
        id: 'page-systems',
        type: 'page',
        label: 'All Systems',
        subLabel: 'Page',
        icon: LayoutGrid,
        url: '/',
        category: 'Pages / Settings',
      },
      {
        id: 'page-docs',
        type: 'page',
        label: 'Documentation',
        subLabel: 'Page',
        icon: BookOpen,
        url: '/docs',
        category: 'Pages / Settings',
      },
      {
        id: 'page-settings',
        type: 'page',
        label: 'Settings',
        subLabel: 'Settings',
        icon: Settings,
        url: '/settings',
        category: 'Pages / Settings',
      },
    ];

    if (role === 'admin') {
      items.push({
        id: 'page-users',
        type: 'page',
        label: 'Users Management',
        subLabel: 'Admin',
        icon: Users,
        url: '/admin/users',
        category: 'Pages / Settings',
      });
    }

    return items;
  }, [role]);

  // Map servers to PaletteItems — derive from data directly inside useMemo to avoid stale deps
  const serverItems = useMemo((): PaletteItem[] => {
    return (data?.agents ?? []).map((server) => ({
      id: `server-${server.agentId}`,
      type: 'server',
      label: server.label || server.hostname,
      subLabel: server.publicIp || server.privateIp || 'Offline',
      icon: ServerIcon,
      url: `/servers/${server.agentId}`,
      category: 'Systems / Servers',
    }));
  }, [data]);

  // Combine items and perform dynamic client-side filtering
  const filteredItems = useMemo(() => {
    const all = [...serverItems, ...pageItems];
    if (!searchQuery) return all;

    const q = searchQuery.toLowerCase();
    return all.filter((item) => {
      return (
        item.label.toLowerCase().includes(q) ||
        (item.subLabel && item.subLabel.toLowerCase().includes(q))
      );
    });
  }, [serverItems, pageItems, searchQuery]);

  // Reset selected index when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  // Keyboard navigation handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (filteredItems.length > 0 ? (prev + 1) % filteredItems.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (filteredItems.length > 0 ? (prev - 1 + filteredItems.length) % filteredItems.length : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const activeItem = filteredItems[selectedIndex];
        if (activeItem) {
          router.push(activeItem.url);
          onClose();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, filteredItems, selectedIndex, router, onClose]);

  if (!isOpen) return null;

  // Group items by category to render categorized sections
  const grouped = filteredItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, PaletteItem[]>);

  // Flattened list indices helper for accurate mouse highlighting sync
  let globalIndexCounter = 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-200">
      <div
        ref={modalRef}
        className="w-full max-w-lg bg-bg-card border border-border rounded-2xl shadow-2xl flex flex-col max-h-[60vh] overflow-hidden transform scale-100 transition-all duration-200"
      >
        {/* Search Input Area */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
          <Search className="h-4 w-4 text-ink-soft shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search for systems or settings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent border-0 text-ink placeholder:text-ink-soft text-sm focus:ring-0 focus:outline-none"
          />
          {searchQuery ? (
            <button
              onClick={() => setSearchQuery('')}
              className="p-1 rounded-md hover:bg-bg-muted text-ink-soft hover:text-ink transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              onClick={onClose}
              className="px-1.5 py-0.5 rounded border border-border text-[10px] text-ink-soft"
            >
              ESC
            </button>
          )}
        </div>

        {/* Results list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-4 max-h-[45vh] scrollbar-thin">
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center text-sm text-ink-soft">
              No results found.
            </div>
          ) : (
            Object.entries(grouped).map(([category, items]) => (
              <div key={category} className="space-y-1">
                <div className="px-3 py-1 text-[10px] font-semibold text-ink-soft uppercase tracking-wider">
                  {category}
                </div>
                <div className="space-y-0.5">
                  {items.map((item) => {
                    const Icon = item.icon;
                    const currentIndex = globalIndexCounter++;
                    const isSelected = currentIndex === selectedIndex;

                    return (
                      <button
                        key={item.id}
                        onMouseEnter={() => setSelectedIndex(currentIndex)}
                        onClick={() => {
                          router.push(item.url);
                          onClose();
                        }}
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-all ${isSelected
                            ? 'bg-bg-muted text-ink'
                            : 'text-ink-muted hover:bg-bg-soft hover:text-ink'
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-1.5 rounded-lg border ${isSelected
                              ? 'bg-bg-soft border-border text-[#3b82f6]'
                              : 'bg-bg-card border-border text-ink-soft'
                            }`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <span className="font-semibold text-sm">{item.label}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-ink-soft font-mono">
                            {item.subLabel}
                          </span>
                          {isSelected && (
                            <CornerDownLeft className="h-3 w-3 text-ink-soft" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer shortcuts badge */}
        <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs text-ink-soft bg-bg-soft/50">
          <div className="flex items-center gap-1.5">
            <span>↑↓ Navigate</span>
            <span className="text-border">•</span>
            <span>↵ Select</span>
            <span className="text-border">•</span>
            <span>Esc Close</span>
          </div>
          <div className="font-mono">
            Ctrl + K to search
          </div>
        </div>
      </div>
    </div>
  );
}
