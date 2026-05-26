'use client';

import useSWR from 'swr';
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, RotateCw, Maximize2, Minimize2 } from 'lucide-react';
import { ContainerData } from './ContainerTable';
import { getMockContainerId } from '@/lib/containers';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface ContainerDetailPanelProps {
  container: ContainerData;
  onClose: () => void;
}

export function ContainerDetailPanel({ container, onClose }: ContainerDetailPanelProps) {
  const [mounted, setMounted] = useState(false);
  const [logsMaximized, setLogsMaximized] = useState(false);
  const [detailsMaximized, setDetailsMaximized] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const queryParams = new URLSearchParams();
  queryParams.set('name', container.name);
  if (container.agentId) {
    queryParams.set('agentId', container.agentId);
  }
  if (container.system) {
    queryParams.set('system', container.system);
  }

  const { data, error, isLoading, mutate } = useSWR<{ logs: string[]; details: any; error?: string }>(
    `/api/containers/detail?${queryParams.toString()}`,
    fetcher
  );

  const mockId = getMockContainerId(container.name);
  const logs = data?.logs || [];
  const details = data?.details || null;
  const showLoading = isLoading || isRefreshing;

  // Prevent scroll on body when drawer is open, and handle mounting for Portal
  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Refresh logs and details by calling SWR mutate
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await mutate();
    } catch (e) {
      console.error('Failed to refresh container details', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Simple HTML syntax highlighting for JSON
  const syntaxHighlight = (jsonObj: any) => {
    const json = JSON.stringify(jsonObj, null, 2);
    if (!json) return '';
    
    // Escape HTML special characters
    const escaped = json
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    return escaped.replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
      (match) => {
        let cls = 'text-warning'; // default: number (adaptive yellow/orange)
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            cls = 'text-accent font-semibold'; // key (adaptive indigo/blue)
          } else {
            cls = 'text-success'; // string (adaptive green)
          }
        } else if (/true|false/.test(match)) {
          cls = 'text-warning font-semibold'; // boolean
        } else if (/null/.test(match)) {
          cls = 'text-ink-soft'; // null (adaptive gray)
        }
        return `<span class="${cls}">${match}</span>`;
      }
    );
  };

  if (!mounted) return null;

  return createPortal(
    <>
      {/* Backdrop Overlay - High Z-index to cover header */}
      <div 
        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm animate-fade-in cursor-pointer"
        onClick={onClose}
      />

      {/* Slide-over Drawer Panel - High Z-index to cover header */}
      <div className="fixed inset-y-0 right-0 z-[110] w-full max-w-xl bg-bg-soft border-l border-border shadow-2xl flex flex-col animate-slide-in-right h-full overflow-hidden">
        
        {/* Header Panel View */}
        <div className="p-5 border-b border-border flex justify-between items-start gap-4 shrink-0 bg-bg-card/40 backdrop-blur-md">
          <div className="space-y-1">
            <h2 className="text-lg font-bold tracking-tight text-ink">{container.name}</h2>
            <div className="text-xs text-ink-muted flex flex-wrap items-center gap-1.5">
              <span>{container.system || 'nub.io.vn'}</span>
              <span className="text-border">•</span>
              <span className="text-ink">{container.status}</span>
              <span className="text-border">•</span>
              <span className="text-ink truncate max-w-[150px]" title={container.image}>{container.image}</span>
              <span className="text-border">•</span>
              <span className="font-mono text-[10px] text-ink-soft bg-bg-muted px-1.5 py-0.5 rounded border border-border">{mockId}</span>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg border border-border text-ink-soft hover:text-ink hover:bg-bg-muted transition-colors cursor-pointer"
            title="Close details"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Drawer Content */}
        <div className="p-5 flex-grow overflow-y-auto space-y-6">
          
          {/* Logs Card Section */}
          <div className="space-y-2 flex flex-col">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold text-ink uppercase tracking-wider">Logs</h3>
              <div className="flex items-center gap-1">
                <button 
                  onClick={handleRefresh}
                  className={`p-1.5 rounded text-ink-soft hover:text-ink hover:bg-bg-muted transition-all cursor-pointer ${isRefreshing ? 'animate-spin' : ''}`}
                  title="Refresh Logs"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                </button>
                <button 
                  onClick={() => setLogsMaximized(true)}
                  className="p-1.5 rounded text-ink-soft hover:text-ink hover:bg-bg-muted transition-all cursor-pointer"
                  title="Maximize"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="terminal-block border border-border rounded-xl p-3.5 font-mono text-[11px] text-ink overflow-auto max-h-[260px] shadow-inner select-text selection:bg-accent/30">
              {showLoading ? (
                <div className="flex py-10 items-center justify-center text-ink-soft">
                  <RotateCw className="h-4 w-4 animate-spin text-accent" />
                </div>
              ) : error || data?.error ? (
                <div className="text-danger p-2">
                  {error?.message || data?.error || 'Failed to load logs'}
                </div>
              ) : logs.length === 0 ? (
                <div className="text-zinc-500 italic p-2">No logs available</div>
              ) : (
                logs.map((line, idx) => (
                  <div key={idx} className="min-h-[1.1rem] whitespace-pre-wrap">{line}</div>
                ))
              )}
            </div>
          </div>

          {/* Details Card Section */}
          <div className="space-y-2 flex flex-col">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold text-ink uppercase tracking-wider">Detail</h3>
              <button 
                onClick={() => setDetailsMaximized(true)}
                className="p-1.5 rounded text-ink-soft hover:text-ink hover:bg-bg-muted transition-all cursor-pointer"
                title="Maximize"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="terminal-block border border-border rounded-xl p-3.5 font-mono text-[11px] overflow-auto max-h-[260px] shadow-inner select-text selection:bg-accent/30 text-ink min-h-[80px]">
              {showLoading ? (
                <div className="flex h-full items-center justify-center text-ink-soft">
                  <RotateCw className="h-4 w-4 animate-spin text-accent" />
                </div>
              ) : error || data?.error ? (
                <div className="text-danger p-2">
                  {error?.message || data?.error || 'Failed to load details'}
                </div>
              ) : !details ? (
                <div className="text-ink-soft italic p-2">No details available</div>
              ) : (
                <pre 
                  className="font-mono text-[11px] select-text selection:bg-accent/30 text-ink"
                  dangerouslySetInnerHTML={{ __html: syntaxHighlight(details) }}
                />
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Maximized Logs Fullscreen Overlay (Rendered as sibling of drawer to escape parent transform context) */}
      {logsMaximized && (
        <div className="fixed inset-0 z-[120] bg-bg flex flex-col p-6 h-screen w-screen overflow-hidden animate-fade-in">
          <div className="flex justify-between items-center mb-4 shrink-0">
            <h3 className="font-semibold text-lg text-ink">Logs: {container.name}</h3>
            <button 
              onClick={() => setLogsMaximized(false)}
              className="p-1.5 rounded-lg hover:bg-bg-muted text-ink-soft hover:text-ink transition-colors cursor-pointer border border-border"
            >
              <Minimize2 className="h-5 w-5" />
            </button>
          </div>
          <div className="terminal-block border border-border rounded-xl p-4 font-mono text-xs text-ink overflow-auto flex-grow shadow-inner select-text selection:bg-accent/30">
            {showLoading ? (
              <div className="flex h-full items-center justify-center text-ink-soft">
                <RotateCw className="h-5 w-5 animate-spin" />
              </div>
            ) : error || data?.error ? (
              <div className="text-danger p-2">
                {error?.message || data?.error || 'Failed to load logs'}
              </div>
            ) : logs.length === 0 ? (
              <div className="text-zinc-500 italic p-2">No logs available</div>
            ) : (
              logs.map((line, idx) => (
                <div key={idx} className="min-h-[1.2rem] whitespace-pre-wrap">{line}</div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Maximized Details Fullscreen Overlay (Rendered as sibling of drawer to escape parent transform context) */}
      {detailsMaximized && (
        <div className="fixed inset-0 z-[120] bg-bg flex flex-col p-6 h-screen w-screen overflow-hidden animate-fade-in">
          <div className="flex justify-between items-center mb-4 shrink-0">
            <h3 className="font-semibold text-lg text-ink">Detail: {container.name}</h3>
            <button 
              onClick={() => setDetailsMaximized(false)}
              className="p-1.5 rounded-lg hover:bg-bg-muted text-ink-soft hover:text-ink transition-colors cursor-pointer border border-border"
            >
              <Minimize2 className="h-5 w-5" />
            </button>
          </div>
          <div className="terminal-block border border-border rounded-xl p-4 font-mono text-xs overflow-auto flex-grow shadow-inner select-text selection:bg-accent/30 text-ink flex flex-col">
            {showLoading ? (
              <div className="flex-grow flex items-center justify-center text-ink-soft">
                <RotateCw className="h-5 w-5 animate-spin" />
              </div>
            ) : error || data?.error ? (
              <div className="text-danger p-2">
                {error?.message || data?.error || 'Failed to load details'}
              </div>
            ) : !details ? (
              <div className="text-zinc-500 italic p-2">No details available</div>
            ) : (
              <pre 
                className="font-mono text-xs select-text selection:bg-accent/30 text-ink"
                dangerouslySetInnerHTML={{ __html: syntaxHighlight(details) }}
              />
            )}
          </div>
        </div>
      )}
    </>,
    document.body
  );
}
