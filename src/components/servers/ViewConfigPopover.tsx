'use client';

import React, { useState } from 'react';
import {
  Layout,
  Filter,
  ArrowUpDown,
  Eye,
  Check,
} from 'lucide-react';

export type VisibleFieldsState = {
  cpu: boolean;
  memory: boolean;
  disk: boolean;
  gpu: boolean;
  loadAvg: boolean;
  net: boolean;
  temp: boolean;
  bat: boolean;
  services: boolean;
  uptime: boolean;
  actions: boolean;
};

interface ViewConfigPopoverProps {
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
  onClose: () => void;
}

const SORT_OPTIONS = [
  { value: 'host', label: 'System' },
  { value: 'cpu', label: 'CPU' },
  { value: 'memory', label: 'Memory' },
  { value: 'disk', label: 'Disk' },
  { value: 'gpu', label: 'GPU' },
  { value: 'loadAvg', label: 'Load Avg' },
  { value: 'net', label: 'Net' },
  { value: 'temp', label: 'Temp' },
  { value: 'bat', label: 'Bat' },
  { value: 'services', label: 'Services' },
  { value: 'uptime', label: 'Uptime' },
];

const FIELDS_LIST: { key: keyof VisibleFieldsState; label: string }[] = [
  { key: 'cpu', label: 'CPU' },
  { key: 'memory', label: 'Memory' },
  { key: 'disk', label: 'Disk' },
  { key: 'gpu', label: 'GPU' },
  { key: 'loadAvg', label: 'Load Avg' },
  { key: 'net', label: 'Net' },
  { key: 'temp', label: 'Temp' },
  { key: 'bat', label: 'Bat' },
  { key: 'services', label: 'Services' },
  { key: 'uptime', label: 'Uptime' },
  { key: 'actions', label: 'Actions' },
];

export function ViewConfigPopover({
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
  onClose,
}: ViewConfigPopoverProps) {
  const [activeTab, setActiveTab] = useState<'layout' | 'status' | 'sort' | 'fields'>('layout');

  const tabs = [
    { id: 'layout' as const, label: 'Layout', icon: Layout },
    { id: 'status' as const, label: 'Status', icon: Filter },
    { id: 'sort' as const, label: 'Sort By', icon: ArrowUpDown },
    { id: 'fields' as const, label: 'Visible Fields', icon: Eye },
  ];

  const handleSortSelect = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  return (
    <>
      {/* Background click to close overlay */}
      <div className="fixed inset-0 z-20" onClick={onClose} />

      {/* Popover Card */}
      <div className="absolute right-0 mt-2 w-72 sm:w-80 rounded-2xl border border-border bg-bg-card/95 backdrop-blur-md shadow-2xl z-30 overflow-hidden text-xs text-ink animate-in fade-in slide-in-from-top-2 duration-150">
        {/* Navigation Tabs */}
        <div className="flex border-b border-border bg-bg-soft/50">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-2.5 px-1 border-b-2 transition-all ${
                  isActive
                    ? 'border-accent text-ink bg-bg-muted/50'
                    : 'border-transparent text-ink-soft hover:text-ink hover:bg-bg-soft'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="text-[10px] font-semibold tracking-tight">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Panel */}
        <div className="p-4 max-h-[300px] overflow-y-auto">
          {/* LAYOUT TAB */}
          {activeTab === 'layout' && (
            <div className="space-y-1.5">
              <button
                onClick={() => setLayout('table')}
                className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-bg-soft transition-colors"
              >
                <span className="font-medium text-ink">Table</span>
                {layout === 'table' ? (
                  <span className="h-4 w-4 rounded-full border-4 border-accent bg-transparent" />
                ) : (
                  <span className="h-4 w-4 rounded-full border-2 border-border bg-transparent" />
                )}
              </button>
              <button
                onClick={() => setLayout('grid')}
                className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-bg-soft transition-colors"
              >
                <span className="font-medium text-ink">Grid</span>
                {layout === 'grid' ? (
                  <span className="h-4 w-4 rounded-full border-4 border-accent bg-transparent" />
                ) : (
                  <span className="h-4 w-4 rounded-full border-2 border-border bg-transparent" />
                )}
              </button>
            </div>
          )}

          {/* STATUS FILTER TAB */}
          {activeTab === 'status' && (
            <div className="space-y-1.5">
              {(['all', 'up', 'down', 'paused'] as const).map((s) => {
                const label =
                  s === 'all'
                    ? 'All Systems'
                    : s === 'up'
                    ? `Up (${counts.up})`
                    : s === 'down'
                    ? `Down (${counts.down})`
                    : `Paused (${counts.paused})`;
                return (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-bg-soft transition-colors"
                  >
                    <span className="font-medium text-ink capitalize">{label}</span>
                    {statusFilter === s ? (
                      <span className="h-4 w-4 rounded-full border-4 border-accent bg-transparent" />
                    ) : (
                      <span className="h-4 w-4 rounded-full border-2 border-border bg-transparent" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* SORT BY TAB */}
          {activeTab === 'sort' && (
            <div className="grid grid-cols-2 gap-1">
              {SORT_OPTIONS.map((opt) => {
                const isCurrent = sortBy === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => handleSortSelect(opt.value)}
                    className={`flex items-center justify-between p-2 rounded-lg hover:bg-bg-soft transition-colors text-left ${
                      isCurrent ? 'bg-bg-soft font-medium text-ink' : 'text-ink-muted'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {isCurrent && (
                      <span className="text-[10px] text-accent font-bold">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* VISIBLE FIELDS TAB */}
          {activeTab === 'fields' && (
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              {FIELDS_LIST.map((field) => {
                const checked = visibleFields[field.key];
                return (
                  <button
                    key={field.key}
                    onClick={() => toggleField(field.key)}
                    className="flex items-center gap-2.5 p-1.5 w-full rounded hover:bg-bg-soft transition-colors text-left"
                  >
                    <span className={`flex items-center justify-center h-4 w-4 rounded border transition-all ${
                      checked
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-border bg-transparent text-transparent hover:border-ink-soft'
                    }`}>
                      <Check className="h-3 w-3 stroke-[3]" />
                    </span>
                    <span className={`font-medium ${checked ? 'text-ink' : 'text-ink-soft'}`}>
                      {field.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
