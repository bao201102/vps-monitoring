'use client';

import useSWR from 'swr';
import React, { useMemo, useState } from 'react';
import { RefreshCw, Loader2, ServerCrash } from 'lucide-react';
import { ContainerTable, ContainerData } from '@/components/ContainerTable';
import { ContainerDetailPanel } from '@/components/ContainerDetailPanel';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function ContainersPage() {
  const { data, isLoading, error, mutate, isValidating } = useSWR<{ containers: ContainerData[] }>(
    '/api/containers',
    fetcher,
    { refreshInterval: 5000 }
  );

  const [selectedContainer, setSelectedContainer] = useState<ContainerData | null>(null);

  const allContainers = useMemo<ContainerData[]>(() => {
    return data?.containers || [];
  }, [data]);

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">All Containers</h1>
          <p className="mt-1 text-sm text-ink-muted">Click on a container to view more information.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => mutate()} className="btn-secondary font-semibold text-xs flex items-center gap-1.5" title="Refresh" disabled={isValidating}>
            <RefreshCw className={`h-3.5 w-3.5 ${isValidating ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-ink-muted card">
          <Loader2 className="mr-2 h-4 w-4 animate-spin text-accent" />
          Loading containers…
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-24 text-ink-muted card gap-2">
          <ServerCrash className="h-8 w-8 text-danger" />
          <p className="text-sm font-semibold">Failed to fetch servers metrics</p>
          <button onClick={() => mutate()} className="btn-secondary text-xs mt-2">
            Retry
          </button>
        </div>
      ) : (
        <>
          <ContainerTable
            containers={allContainers}
            showSystem={true}
            selectedContainer={selectedContainer}
            onSelectContainer={setSelectedContainer}
          />
          {selectedContainer && (
            <ContainerDetailPanel
              container={selectedContainer}
              onClose={() => setSelectedContainer(null)}
            />
          )}
        </>
      )}
    </div>
  );
}
