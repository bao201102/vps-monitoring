import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Agent } from '@/lib/models/Agent';
import { Metric } from '@/lib/models/Metric';
import { DockerContainer } from '@/lib/models/DockerContainer';
import { CONTAINERS_BY_AGENT, CONTAINER_MOCK_LOGS, CONTAINER_MOCK_DETAILS } from '@/lib/containers';
import { getSessionFromCookies } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized. Hãy đăng nhập trước.' }, { status: 401 });
  }

  await connectDB();

  // Clear existing mock data if any (only for this user's mock agents to prevent pollution)
  const mockAgentIds = ['instance-20260414-1357', 'monitoring', 'vps-paused'];
  await Agent.deleteMany({ agentId: { $in: mockAgentIds }, userId: session.sub });
  await Metric.deleteMany({ agentId: { $in: mockAgentIds } });
  await DockerContainer.deleteMany({ agentId: { $in: mockAgentIds } });

  const now = new Date();

  // 1. Create mock agents
  const agentsToInsert = [
    {
      userId: session.sub,
      agentId: 'instance-20260414-1357',
      hostname: 'instance-20260414-1357',
      label: 'nub.io.vn',
      token: 'mock-token-1',
      os: 'Ubuntu',
      osVersion: '24.04.4 LTS',
      kernel: 'Linux 6.8.0-1018-oracle',
      arch: 'aarch64',
      cpuModel: 'Neoverse-N1',
      cpuCores: 1,
      totalMemoryBytes: 5.77 * 1024 * 1024 * 1024,
      totalDiskBytes: 47.4 * 1024 * 1024 * 1024,
      publicIp: '213.35.104.28',
      privateIp: '10.0.0.4',
      tags: ['production', 'web'],
      online: true,
      lastSeenAt: now,
      registeredAt: new Date(now.getTime() - 42 * 24 * 60 * 60 * 1000),
    },
    {
      userId: session.sub,
      agentId: 'monitoring',
      hostname: 'monitoring',
      label: 'monitoring',
      token: 'mock-token-2',
      os: 'Ubuntu',
      osVersion: '24.04',
      kernel: 'Linux 6.8.0-31-generic',
      arch: 'x86_64',
      cpuModel: 'Intel Xeon Platinum',
      cpuCores: 2,
      totalMemoryBytes: 5.8 * 1024 * 1024 * 1024,
      totalDiskBytes: 20.0 * 1024 * 1024 * 1024,
      publicIp: '161.118.211.174',
      privateIp: '192.168.1.15',
      tags: ['internal', 'monitoring'],
      online: true,
      lastSeenAt: now,
      registeredAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
    },
    {
      userId: session.sub,
      agentId: 'vps-paused',
      hostname: 'vps-paused',
      label: 'vps-paused',
      token: 'mock-token-3',
      os: 'Debian',
      osVersion: '12',
      kernel: 'Linux 6.1.0-21-amd64',
      arch: 'x86_64',
      cpuModel: 'AMD EPYC 7002',
      cpuCores: 2,
      totalMemoryBytes: 4.0 * 1024 * 1024 * 1024,
      totalDiskBytes: 50.0 * 1024 * 1024 * 1024,
      publicIp: '192.168.1.100',
      privateIp: '192.168.1.100',
      tags: ['paused', 'test'],
      online: false,
      lastSeenAt: new Date(now.getTime() - 3 * 60 * 60 * 1000), // Offline since 3h ago
      registeredAt: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
    },
  ];

  await Agent.insertMany(agentsToInsert);

  // 1.5. Create mock containers in DB
  const containersToInsert: any[] = [];
  
  // containers for nub.io.vn (instance-20260414-1357)
  const nubContainers = CONTAINERS_BY_AGENT['nub.io.vn'] || [];
  nubContainers.forEach(c => {
    containersToInsert.push({
      agentId: 'instance-20260414-1357',
      name: c.name,
      image: c.image,
      ports: c.ports,
      status: c.status,
      health: c.health,
      cpuWeight: c.cpuWeight,
      memWeight: c.memWeight,
      netWeight: c.netWeight,
      defaultCpu: c.defaultCpu,
      defaultMem: c.defaultMem,
      defaultNet: c.defaultNet,
      color: c.color,
      logs: CONTAINER_MOCK_LOGS[c.name] || [],
      details: CONTAINER_MOCK_DETAILS[c.name] || {}
    });
  });

  // containers for root/monitoring (monitoring)
  const rootContainers = CONTAINERS_BY_AGENT['root'] || [];
  rootContainers.forEach(c => {
    containersToInsert.push({
      agentId: 'monitoring',
      name: c.name,
      image: c.image,
      ports: c.ports,
      status: c.status,
      health: c.health,
      cpuWeight: c.cpuWeight,
      memWeight: c.memWeight,
      netWeight: c.netWeight,
      defaultCpu: c.defaultCpu,
      defaultMem: c.defaultMem,
      defaultNet: c.defaultNet,
      color: c.color,
      logs: CONTAINER_MOCK_LOGS[c.name] || [],
      details: CONTAINER_MOCK_DETAILS[c.name] || {}
    });
  });

  await DockerContainer.insertMany(containersToInsert);

  // 2. Generate historical metrics for the past 2 hours (every 1 minute -> 120 points per agent)
  const metricsToInsert = [];

  for (let i = 120; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * 1 * 60 * 1000);

    // Agent 1: nub.io.vn metrics
    // Slight random variations to make charts look alive
    const cpuVal1 = 1.0 + Math.random() * 4.8; // 1% - 5.8%
    const memUsed1 = (1.2 + Math.random() * 0.2) * 1024 * 1024 * 1024; // 1.2 - 1.4 GB
    const diskUsed1 = 13.8 * 1024 * 1024 * 1024; // Constant 13.8 GB
    const readBps1 = Math.random() * 1024; // Low activity
    const writeBps1 = Math.random() * 4096;
    const rxBps1 = 512 + Math.random() * 2048;
    const txBps1 = 256 + Math.random() * 1024;

    const dockerCpu1 = 0.1 + Math.random() * 0.5; // Stacked containers CPU
    const dockerMemUsed1 = 539.67 * 1024 * 1024; // Constant ~540MB
    const dockerNetRx1 = Math.random() * 300;
    const dockerNetTx1 = Math.random() * 150;

    metricsToInsert.push({
      agentId: 'instance-20260414-1357',
      ts: timestamp,
      cpuPercent: cpuVal1,
      loadAvg1: 0.01 + Math.random() * 0.15,
      loadAvg5: 0.02 + Math.random() * 0.08,
      loadAvg15: 0.01 + Math.random() * 0.05,
      memUsedBytes: memUsed1,
      memTotalBytes: 5.77 * 1024 * 1024 * 1024,
      swapUsedBytes: 0,
      swapTotalBytes: 0,
      diskUsedBytes: diskUsed1,
      diskTotalBytes: 47.4 * 1024 * 1024 * 1024,
      diskReadBps: readBps1,
      diskWriteBps: writeBps1,
      netRxBytes: 0,
      netTxBytes: 0,
      netRxBps: rxBps1,
      netTxBps: txBps1,
      dockerCpuPercent: dockerCpu1,
      dockerMemUsedBytes: dockerMemUsed1,
      dockerNetRxBps: dockerNetRx1,
      dockerNetTxBps: dockerNetTx1,
      dockerContainerCount: 5,
      temperatureC: 45 + Math.random() * 5,
      gpuUtilPercent: 0,
      gpuMemUsedBytes: 0,
      gpuMemTotalBytes: 0,
      gpuPowerWatts: 0,
      uptimeSeconds: 42 * 24 * 60 * 60 - i * 60,
      processCount: 95,
    });

    // Agent 2: monitoring metrics
    const cpuVal2 = 2.0 + Math.random() * 5.0; // 2% - 7%
    const memUsed2 = (0.75 + Math.random() * 0.1) * 1024 * 1024 * 1024;
    const diskUsed2 = 2.4 * 1024 * 1024 * 1024;
    const rxBps2 = 1024 + Math.random() * 5000;
    const txBps2 = 512 + Math.random() * 2000;

    metricsToInsert.push({
      agentId: 'monitoring',
      ts: timestamp,
      cpuPercent: cpuVal2,
      loadAvg1: 0.05 + Math.random() * 0.1,
      loadAvg5: 0.04 + Math.random() * 0.05,
      loadAvg15: 0.03 + Math.random() * 0.03,
      memUsedBytes: memUsed2,
      memTotalBytes: 5.8 * 1024 * 1024 * 1024,
      swapUsedBytes: 0,
      swapTotalBytes: 0,
      diskUsedBytes: diskUsed2,
      diskTotalBytes: 20.0 * 1024 * 1024 * 1024,
      diskReadBps: Math.random() * 512,
      diskWriteBps: Math.random() * 2048,
      netRxBytes: 0,
      netTxBytes: 0,
      netRxBps: rxBps2,
      netTxBps: txBps2,
      dockerCpuPercent: 0,
      dockerMemUsedBytes: 0,
      dockerNetRxBps: 0,
      dockerNetTxBps: 0,
      dockerContainerCount: 0,
      temperatureC: 40 + Math.random() * 3,
      gpuUtilPercent: 0,
      gpuMemUsedBytes: 0,
      gpuMemTotalBytes: 0,
      gpuPowerWatts: 0,
      uptimeSeconds: 26 * 60 * 60 - i * 60,
      processCount: 110,
    });

    // Agent 3: vps-paused metrics (only historical up to 15m ago)
    if (i >= 15) {
      const cpuVal3 = 0.5 + Math.random() * 1.5;
      const memUsed3 = 0.4 * 1024 * 1024 * 1024;
      const diskUsed3 = 12.0 * 1024 * 1024 * 1024;

      metricsToInsert.push({
        agentId: 'vps-paused',
        ts: timestamp,
        cpuPercent: cpuVal3,
        loadAvg1: 0.01,
        loadAvg5: 0.01,
        loadAvg15: 0.01,
        memUsedBytes: memUsed3,
        memTotalBytes: 4.0 * 1024 * 1024 * 1024,
        swapUsedBytes: 0,
        swapTotalBytes: 0,
        diskUsedBytes: diskUsed3,
        diskTotalBytes: 50.0 * 1024 * 1024 * 1024,
        diskReadBps: 0,
        diskWriteBps: 0,
        netRxBytes: 0,
        netTxBytes: 0,
        netRxBps: 0,
        netTxBps: 0,
        dockerCpuPercent: 0,
        dockerMemUsedBytes: 0,
        dockerNetRxBps: 0,
        dockerNetTxBps: 0,
        dockerContainerCount: 0,
        temperatureC: 35,
        gpuUtilPercent: 0,
        gpuMemUsedBytes: 0,
        gpuMemTotalBytes: 0,
        gpuPowerWatts: 0,
        uptimeSeconds: 20 * 24 * 60 * 60 - i * 60,
        processCount: 65,
      });
    }
  }

  await Metric.insertMany(metricsToInsert);

  // Redirect back to dashboard list so the user immediately sees the mock servers
  const url = new URL(req.url);
  return NextResponse.redirect(`${url.origin}/servers`);
}
