'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  Globe,
  Radio,
  Loader2,
  Shield,
  ShieldAlert,
  Server,
  ExternalLink,
  Cpu,
} from 'lucide-react';
import useSWR from 'swr';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export interface VpsPortData {
  proto: string;
  ip: string;
  port: number;
  service: string;
  pid: number | null;
  updatedAt?: string;
}

export interface VpsDomainData {
  domain: string;
  type: string;
  target?: string;
  updatedAt?: string;
}

interface PortsTabProps {
  agentId: string;
  agentLabel?: string;
  agentHostname?: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function PortsTab({ agentId, agentLabel, agentHostname }: PortsTabProps) {
  const { data, isLoading, mutate } = useSWR<{ ports: VpsPortData[]; domains: VpsDomainData[] }>(
    `/api/agents/${agentId}/ports`,
    fetcher,
    { refreshInterval: 10000 }
  );

  const [searchQuery, setSearchQuery] = useState('');

  const ports = useMemo(() => data?.ports || [], [data?.ports]);
  const domains = useMemo(() => data?.domains || [], [data?.domains]);

  // Filters domains and ports based on search query
  const filteredDomains = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return domains.filter((d) => 
      d.domain.toLowerCase().includes(q) || 
      d.type.toLowerCase().includes(q) ||
      (d.target && d.target.toLowerCase().includes(q))
    );
  }, [domains, searchQuery]);

  const filteredPorts = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return ports.filter((p) => 
      p.port.toString().includes(q) || 
      p.service.toLowerCase().includes(q) || 
      p.proto.toLowerCase().includes(q) ||
      p.ip.toLowerCase().includes(q)
    );
  }, [ports, searchQuery]);

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-24 text-ink-muted card">
        <Loader2 className="mr-2 h-4 w-4 animate-spin text-accent" />
        Loading network configuration…
      </div>
    );
  }

  // Calculate stats
  const totalPorts = ports.length;
  const publicPorts = ports.filter(
    (p) => p.ip === '0.0.0.0' || p.ip === '::'
  ).length;
  const totalDomains = domains.length;

  // Custom badges for well-known services
  const getServiceBadgeStyle = (service: string) => {
    const s = service.toLowerCase();
    if (s.includes('nginx')) return 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20';
    if (s.includes('apache') || s.includes('httpd')) return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
    if (s.includes('caddy')) return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    if (s.includes('ssh')) return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
    if (s.includes('node') || s.includes('pm2')) return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    if (s.includes('mongo') || s.includes('mongod')) return 'bg-green-600/10 text-green-500 border-green-600/20';
    if (s.includes('postgres') || s.includes('redis') || s.includes('mysql')) return 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20';
    if (s.includes('docker')) return 'bg-sky-400/10 text-sky-400 border-sky-400/20';
    return 'bg-bg-muted/70 text-ink-muted border-border/70';
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
              Total Listening Ports
            </div>
            <div className="text-2xl font-bold mt-1 text-ink">{totalPorts}</div>
          </div>
          <div className="p-3 rounded-xl bg-accent/10 text-accent">
            <Radio className="h-6 w-6" />
          </div>
        </div>

        <div className="card p-5 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
              Publicly Exposed Ports
            </div>
            <div className="text-2xl font-bold mt-1 text-ink flex items-center gap-2">
              {publicPorts}
              {publicPorts > 0 && (
                <span className="inline-flex h-2 w-2 rounded-full bg-warning animate-ping" />
              )}
            </div>
          </div>
          <div className={cn(
            "p-3 rounded-xl",
            publicPorts > 0 ? "bg-warning/15 text-warning" : "bg-success/10 text-success"
          )}>
            {publicPorts > 0 ? <ShieldAlert className="h-6 w-6" /> : <Shield className="h-6 w-6" />}
          </div>
        </div>

        <div className="card p-5 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
              Hosted Domains
            </div>
            <div className="text-2xl font-bold mt-1 text-ink">{totalDomains}</div>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500">
            <Globe className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Header and Search */}
      <div className="card-interactive p-4 sm:flex sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-ink">Search & Filter</h2>
          <p className="text-xs text-ink-muted">Query active listening ports, process names, or domains</p>
        </div>
        <div className="relative max-w-md w-full mt-3 sm:mt-0 shrink-0">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-ink-soft">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            placeholder="Search ports, services, or domains..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-9 py-1.5 bg-bg-muted/30 border border-border rounded-lg text-xs"
          />
        </div>
      </div>

      {/* Main Grid: Domains Left, Ports Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Domains (40% width) */}
        <div className="card lg:col-span-5 overflow-hidden flex flex-col">
          <div className="border-b border-border bg-bg-soft/30 px-5 py-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="text-sm font-bold tracking-tight text-ink flex items-center gap-2">
                <Globe className="h-4 w-4 text-emerald-500" />
                Hosted Domains
              </h3>
              <p className="text-[10px] text-ink-muted">Web proxy server configurations detected on host</p>
            </div>
            <span className="chip chip-muted px-2 py-0.5 text-[10px]">{filteredDomains.length} domains</span>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border text-ink-soft font-semibold bg-bg-muted/40 select-none">
                  <th className="py-2.5 px-4">Domain / Host</th>
                  <th className="py-2.5 px-4">Proxy Target</th>
                  <th className="py-2.5 px-4 w-24">Proxy Type</th>
                  <th className="py-2.5 px-3 w-12 text-center">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-ink">
                {filteredDomains.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-ink-soft font-mono">
                      No domains found
                    </td>
                  </tr>
                ) : (
                  filteredDomains.map((domain, idx) => (
                    <tr key={domain.domain + idx} className="hover:bg-bg-soft/50 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-ink break-all text-xs">
                        {domain.domain}
                      </td>
                      <td className="py-3 px-4 font-mono">
                        {domain.target && domain.target !== 'static' ? (
                          <span className="text-accent font-semibold text-[10px] bg-accent/5 px-2 py-0.5 rounded-md border border-accent/10 whitespace-nowrap">
                            {domain.target}
                          </span>
                        ) : (
                          <span className="text-ink-soft font-normal text-[10px] bg-bg-muted/50 px-2 py-0.5 rounded-md border border-border/40 whitespace-nowrap">
                            static / local
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className={cn(
                          "chip text-[10px] px-2 py-0.5 capitalize",
                          domain.type === 'nginx' ? 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20' :
                          domain.type === 'apache' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' :
                          'bg-blue-500/10 text-blue-500 border-blue-500/20'
                        )}>
                          {domain.type}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <a
                          href={`http://${domain.domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex p-1 rounded-md text-ink-soft hover:text-accent hover:bg-bg-muted transition-all"
                          title="Open website"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Ports (70% width) */}
        <div className="card lg:col-span-7 overflow-hidden flex flex-col">
          <div className="border-b border-border bg-bg-soft/30 px-5 py-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="text-sm font-bold tracking-tight text-ink flex items-center gap-2">
                <Radio className="h-4 w-4 text-accent" />
                Listening Ports
              </h3>
              <p className="text-[10px] text-ink-muted">Currently active listening socket processes (ss -tulpn)</p>
            </div>
            <span className="chip chip-muted px-2 py-0.5 text-[10px]">{filteredPorts.length} sockets</span>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border text-ink-soft font-semibold bg-bg-muted/40 select-none">
                  <th className="py-2.5 px-4 w-16">Proto</th>
                  <th className="py-2.5 px-4 w-20">Port</th>
                  <th className="py-2.5 px-4">Local IP / Bind</th>
                  <th className="py-2.5 px-4">Process / Service</th>
                  <th className="py-2.5 px-4 w-24 text-center">Exposure</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-ink">
                {filteredPorts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-ink-soft font-mono">
                      No active ports found
                    </td>
                  </tr>
                ) : (
                  filteredPorts.map((port, idx) => {
                    const isPublic = port.ip === '0.0.0.0' || port.ip === '::';
                    return (
                      <tr key={`${port.proto}-${port.port}-${port.ip}-${idx}`} className="hover:bg-bg-soft/50 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold uppercase text-ink-soft">
                          {port.proto}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-ink">
                          {port.port}
                        </td>
                        <td className="py-3 px-4 font-mono text-ink-muted">
                          {port.ip}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className={cn(
                              "chip text-[10px] px-2 py-0.5 font-mono border",
                              getServiceBadgeStyle(port.service)
                            )}>
                              {port.service}
                            </span>
                            {port.pid && (
                              <span className="text-[10px] text-ink-soft font-mono">
                                (PID: {port.pid})
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                            isPublic 
                              ? "bg-warning/10 text-warning border-warning/20" 
                              : "bg-success/10 text-success border-success/20"
                          )}>
                            <span className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              isPublic ? "bg-warning animate-pulse" : "bg-success"
                            )} />
                            {isPublic ? "Public" : "Local"}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
