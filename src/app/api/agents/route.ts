import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Agent } from '@/lib/models/Agent';
import { SystemService } from '@/lib/models/SystemService';
import { Incident } from '@/lib/models/Incident';
import { getSessionFromCookies } from '@/lib/auth';
import { env } from '@/lib/env';
import { compareVersions, latestAgentVersion } from '@/lib/agent-script';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectDB();
  /** Stable order (not by lastSeenAt) so dashboard / server list cards do not reorder every heartbeat. */
  const agents = await Agent.find({ userId: session.sub })
    .select('-token -nextToken -portsHash -domainsHash')
    .sort({ hostname: 1, agentId: 1 })
    .lean();
  const ids = agents.map((a) => a.agentId);

  const [serviceCounts, incidentCounts, latestVersion] = await Promise.all([
    SystemService.aggregate<{ _id: string; total: number; failed: number }>([
      { $match: { agentId: { $in: ids } } },
      {
        $group: {
          _id: '$agentId',
          total: { $sum: 1 },
          failed: {
            $sum: { $cond: [{ $or: [{ $eq: ['$state', 'Failed'] }, { $eq: ['$subState', 'Failed'] }] }, 1, 0] },
          },
        },
      },
    ]),
    Incident.aggregate<{ _id: string; open: number }>([
      { $match: { agentId: { $in: ids }, status: 'open' } },
      { $group: { _id: '$agentId', open: { $sum: 1 } } },
    ]),
    latestAgentVersion(),
  ]);
  const servicesMap = new Map(serviceCounts.map((s) => [s._id, s]));
  const incidentsMap = new Map(incidentCounts.map((s) => [s._id, s.open]));

  const offlineMs = env.AGENT_OFFLINE_AFTER_SECONDS * 1000;
  const now = Date.now();

  const data = agents.map((a) => {
    const m = a.latest;
    const online = Boolean(a.lastSeenAt && now - new Date(a.lastSeenAt).getTime() <= offlineMs);
    const servInfo = servicesMap.get(a.agentId);
    return {
      agentId: a.agentId,
      hostname: a.hostname,
      label: a.label,
      os: a.os,
      osVersion: a.osVersion,
      kernel: a.kernel,
      arch: a.arch,
      cpuModel: a.cpuModel,
      cpuCores: a.cpuCores,
      totalMemoryBytes: a.totalMemoryBytes,
      totalDiskBytes: a.totalDiskBytes,
      publicIp: a.publicIp,
      privateIp: a.privateIp,
      tags: a.tags,
      online,
      lastSeenAt: a.lastSeenAt,
      registeredAt: a.registeredAt,
      agentVersion: a.agentVersion ?? null,
      updateAvailable: compareVersions(a.agentVersion ?? '0', latestVersion) < 0,
      remoteCommands: Boolean(a.remoteCommands),
      disks: a.disks ?? [],
      servicesCount: servInfo?.total ?? 0,
      servicesFailedCount: servInfo?.failed ?? 0,
      openIncidents: incidentsMap.get(a.agentId) ?? 0,
      latest: m
        ? {
            ts: m.ts,
            cpuPercent: m.cpuPercent,
            memUsedBytes: m.memUsedBytes,
            memTotalBytes: m.memTotalBytes,
            diskUsedBytes: m.diskUsedBytes,
            diskTotalBytes: m.diskTotalBytes,
            diskReadBps: m.diskReadBps,
            diskWriteBps: m.diskWriteBps,
            netRxBytes: m.netRxBytes,
            netTxBytes: m.netTxBytes,
            netRxBps: m.netRxBps,
            netTxBps: m.netTxBps,
            dockerCpuPercent: m.dockerCpuPercent,
            dockerMemUsedBytes: m.dockerMemUsedBytes,
            dockerNetRxBps: m.dockerNetRxBps,
            dockerNetTxBps: m.dockerNetTxBps,
            dockerContainerCount: m.dockerContainerCount,
            temperatureC: m.temperatureC,
            gpuUtilPercent: m.gpuUtilPercent,
            gpuMemUsedBytes: m.gpuMemUsedBytes,
            gpuMemTotalBytes: m.gpuMemTotalBytes,
            gpuPowerWatts: m.gpuPowerWatts,
            uptimeSeconds: m.uptimeSeconds,
            loadAvg1: m.loadAvg1,
            loadAvg5: m.loadAvg5,
            loadAvg15: m.loadAvg15,
          }
        : null,
    };
  });

  return NextResponse.json({ agents: data, latestAgentVersion: latestVersion });
}
