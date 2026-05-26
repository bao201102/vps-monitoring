'use client';

import React, { useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { ViewConfigPopover, VisibleFieldsState } from './ViewConfigPopover';

interface ServerToolbarProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  layout: 'table' | 'grid';
  setLayout: (l: 'table' | 'grid') => void;
  statusFilter: 'all' | 'up' | 'down' | 'paused';
  setStatusFilter: (s: 'all' | 'up' | 'down' | 'paused') => void;
  sortBy: string;
  setSortBy: (field: string) => void;
  sortOrder: 'asc' | 'desc';
  setSortOrder: (o: 'asc' | 'desc') => void;
  visibleFields: VisibleFieldsState;
  toggleField: (field: keyof VisibleFieldsState) => void;
  counts: {
    all: number;
    up: number;
    down: number;
    paused: number;
  };
}

export function ServerToolbar({
  searchQuery,
  setSearchQuery,
  layout,
  setLayout,
  statusFilter,
  setStatusFilter,
  sortBy,
  setSortBy,
  sortOrder,
  setSortOrder,
  visibleFields,
  toggleField,
  counts,
}: ServerToolbarProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3 border-b border-border bg-bg-soft/30 px-5 py-4 sm:flex-row sm:items-center sm:justify-between rounded-t-2xl">
      {/* Search Input Box */}
      <div className="relative max-w-sm flex-1">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-ink-soft">
          <Search className="h-4 w-4" />
        </span>
        <input
          type="text"
          placeholder="Search by hostname, IP, OS…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input pl-9 py-1.5"
        />
      </div>

      {/* View Options Popover Control */}
      <div className="relative self-end sm:self-auto">
        <button
          onClick={() => setPopoverOpen(!popoverOpen)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
            popoverOpen
              ? 'border-[#3b82f6] bg-bg-soft text-ink'
              : 'border-border bg-bg-card text-ink-muted hover:text-ink hover:bg-bg-soft'
          }`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          View
        </button>

        {popoverOpen && (
          <ViewConfigPopover
            layout={layout}
            setLayout={setLayout}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            sortBy={sortBy}
            setSortBy={setSortBy}
            sortOrder={sortOrder}
            setSortOrder={setSortOrder}
            visibleFields={visibleFields}
            toggleField={toggleField}
            counts={counts}
            onClose={() => setPopoverOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
