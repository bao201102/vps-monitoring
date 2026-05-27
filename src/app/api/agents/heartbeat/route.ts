import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserResolvedAlertSettings } from '@/lib/user-settings';
import { connectDB } from '@/lib/db';
import { env } from '@/lib/env';
import { Agent } from '@/lib/models/Agent';
import { Metric } from '@/lib/models/Metric';
import { AgentCommand } from '@/lib/models/AgentCommand';
import { SystemService } from '@/lib/models/SystemService';
import { ServiceMetric } from '@/lib/models/ServiceMetric';
import { DockerContainer } from '@/lib/models/DockerContainer';
import { sendTelegramDisconnectIfNeeded, sendTelegramOverloadIfNeeded } from '@/lib/telegram-alerts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  agentId: z.string().min(1),
  token: z.string().min(1),
  status: z.enum(['heartbeat', 'shutdown']).default('heartbeat'),
  cpuPercent: z.number().min(0).max(100).default(0),
  loadAvg1: z.number().min(0).default(0),
  loadAvg5: z.number().min(0).default(0),
  loadAvg15: z.number().min(0).default(0),
  memUsedBytes: z.number().min(0).default(0),
  memTotalBytes: z.number().min(0).default(0),
  swapUsedBytes: z.number().min(0).default(0),
  swapTotalBytes: z.number().min(0).default(0),
  diskUsedBytes: z.number().min(0).default(0),
  diskTotalBytes: z.number().min(0).default(0),
  diskReadBps: z.number().min(0).default(0),
  diskWriteBps: z.number().min(0).default(0),
  netRxBytes: z.number().min(0).default(0),
  netTxBytes: z.number().min(0).default(0),
  netRxBps: z.number().min(0).default(0),
  netTxBps: z.number().min(0).default(0),
  dockerCpuPercent: z.number().min(0).default(0),
  dockerMemUsedBytes: z.number().min(0).default(0),
  dockerNetRxBps: z.number().min(0).default(0),
  dockerNetTxBps: z.number().min(0).default(0),
  dockerContainerCount: z.number().int().min(0).default(0),
  temperatureC: z.number().min(0).default(0),
  // Multi-sensor temperatures: { "CPU Package": 72.5, "GPU Temp": 65.0, ... }
  // Optional: new agents send this; old agents only send temperatureC
  temperatures: z.record(z.string(), z.number()).optional(),
  gpuUtilPercent: z.number().min(0).max(100).default(0),
  gpuMemUsedBytes: z.number().min(0).default(0),
  gpuMemTotalBytes: z.number().min(0).default(0),
  gpuPowerWatts: z.number().min(0).default(0),
  uptimeSeconds: z.number().min(0).default(0),
  processCount: z.number().int().min(0).default(0),
  services: z.array(z.object({
    name: z.string(),
    description: z.string().default(''),
    state: z.string().default('Inactive'),
    subState: z.string().default('Dead'),
    memory: z.number().default(0),
    cpuPercent: z.number().default(0), // actual per-service CPU reported by agent
    // Extended metadata
    fragmentPath: z.string().optional(),
    mainPid: z.number().optional(),
    nRestarts: z.number().optional(),
    tasksCurrent: z.number().optional(),
    tasksMax: z.number().optional(),
    requires: z.array(z.string()).optional(),
    documentation: z.array(z.string()).optional(),
    unitFileState: z.string().optional(),
    loadState: z.string().optional(),
    activeEnterTimestamp: z.string().optional(),
  })).optional(),
  containers: z.array(z.object({
    name: z.string(),
    image: z.string(),
    ports: z.string().default(''),
    status: z.string().default(''),
    health: z.string().default('None'),
    cpuPercent: z.number().default(0),
    memUsedBytes: z.number().default(0),
    netRxBps: z.number().default(0),
    netTxBps: z.number().default(0),
    logs: z.array(z.string()).default([]),
    details: z.record(z.any()).default({}),
  })).optional(),
});

const PALETTE = [
  '#ea580c', // Orange
  '#8b5cf6', // Violet
  '#3b82f6', // Blue
  '#eab308', // Yellow
  '#10b981', // Emerald
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f43f5e', // Rose
  '#a855f7', // Purple
  '#14b8a6'  // Teal
];

function getDeterministicColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  await connectDB();

  const agent = await Agent.findOne({
    agentId: parsed.data.agentId,
    token: parsed.data.token,
  });

  if (!agent) {
    return NextResponse.json({ error: 'Unknown agent or invalid token' }, { status: 401 });
  }

  const now = new Date();
  const previousLastSeenAt = agent.lastSeenAt;
  agent.lastSeenAt = now;

  if (parsed.data.status === 'shutdown') {
    const appSettings = await getUserResolvedAlertSettings(agent.userId);
    const sent = await sendTelegramDisconnectIfNeeded(
      {
        agentId: agent.agentId,
        hostname: agent.hostname,
        label: agent.label,
        publicIp: agent.publicIp,
        lastSeenAt: previousLastSeenAt ?? now,
        lastTelegramOfflineAlertAt: agent.lastTelegramOfflineAlertAt,
      },
      appSettings,
      env.APP_URL,
      'shutdown'
    );
    if (sent) {
      agent.lastTelegramOfflineAlertAt = now;
    }
    await agent.save();
    return NextResponse.json({ ok: true });
  }

  // Process and update SystemService records from the heartbeat payload
  if (parsed.data.services) {
    const reportedNames = parsed.data.services.map(s => s.name);
    await SystemService.deleteMany({ agentId: agent.agentId, name: { $nin: reportedNames } });

    for (const s of parsed.data.services) {
      const existing = await SystemService.findOne({ agentId: agent.agentId, name: s.name });
      const nowTime = new Date();
      const updatedTimeStr = nowTime.toISOString();

      const isRunning = s.subState === 'Running';
      // Use actual cpuPercent from agent; fallback 0 for non-running services
      const currentCpu = isRunning ? (s.cpuPercent ?? 0) : null;
      const currentMem = s.memory > 0 ? s.memory : null;

      // Snapshot ServiceMetric for history (only when running and has real data)
      if (isRunning && (currentCpu !== null || currentMem !== null)) {
        await ServiceMetric.create({
          agentId: agent.agentId,
          serviceName: s.name,
          ts: now,
          cpuPercent: currentCpu,
          memBytes: currentMem,
        });
      }

      const extendedFields = {
        fragmentPath: s.fragmentPath,
        mainPid: s.mainPid,
        nRestarts: s.nRestarts,
        tasksCurrent: s.tasksCurrent,
        tasksMax: s.tasksMax,
        requires: s.requires,
        documentation: s.documentation,
        unitFileState: s.unitFileState,
        loadState: s.loadState,
        activeEnterTimestamp: s.activeEnterTimestamp,
      };

      if (existing) {
        existing.state = s.state;
        existing.subState = s.subState;
        existing.memory = currentMem;
        if (isRunning && currentMem && (!existing.memoryPeak || currentMem > existing.memoryPeak)) {
          existing.memoryPeak = currentMem;
        }
        existing.cpu10m = currentCpu;
        if (isRunning && currentCpu !== null && (!existing.cpuPeak || currentCpu > existing.cpuPeak)) {
          existing.cpuPeak = currentCpu;
        }
        existing.updated = updatedTimeStr;
        // Update extended metadata if provided
        Object.assign(existing, extendedFields);
        await existing.save();
      } else {
        await SystemService.create({
          agentId: agent.agentId,
          name: s.name,
          description: s.description,
          state: s.state,
          subState: s.subState,
          memory: currentMem,
          memoryPeak: currentMem,
          cpu10m: currentCpu,
          cpuPeak: currentCpu,
          updated: updatedTimeStr,
          ...extendedFields,
        });
      }
    }
  }

  // Process and update DockerContainer records from the heartbeat payload
  if (parsed.data.containers) {
    const activeNames = parsed.data.containers.map(c => c.name);
    
    // Remove containers that are no longer reported by this agent
    await DockerContainer.deleteMany({ agentId: agent.agentId, name: { $nin: activeNames } });

    const totalCpu = parsed.data.dockerCpuPercent;
    const totalMem = parsed.data.dockerMemUsedBytes;
    const totalNet = parsed.data.dockerNetRxBps + parsed.data.dockerNetTxBps;

    for (const c of parsed.data.containers) {
      const cpuWeight = totalCpu > 0 ? c.cpuPercent / totalCpu : 0;
      const memWeight = totalMem > 0 ? c.memUsedBytes / totalMem : 0;
      const netWeight = totalNet > 0 ? (c.netRxBps + c.netTxBps) / totalNet : 0;
      const health = c.health === 'Healthy' || c.health === 'Unhealthy' ? c.health : 'None';

      await DockerContainer.findOneAndUpdate(
        { agentId: agent.agentId, name: c.name },
        {
          image: c.image,
          ports: c.ports,
          status: c.status,
          health,
          cpuWeight: Number(cpuWeight.toFixed(4)),
          memWeight: Number(memWeight.toFixed(4)),
          netWeight: Number(netWeight.toFixed(4)),
          defaultCpu: c.cpuPercent,
          defaultMem: c.memUsedBytes,
          defaultNet: c.netRxBps + c.netTxBps,
          color: getDeterministicColor(c.name),
          logs: c.logs,
          details: c.details,
        },
        { upsert: true, new: true }
      );
    }
  } else if (parsed.data.dockerContainerCount === 0) {
    // Clean up if agent explicitly reports 0 container count
    await DockerContainer.deleteMany({ agentId: agent.agentId });
  }

  await agent.save();

  await Metric.create({
    agentId: agent.agentId,
    ts: now,
    cpuPercent: parsed.data.cpuPercent,
    loadAvg1: parsed.data.loadAvg1,
    loadAvg5: parsed.data.loadAvg5,
    loadAvg15: parsed.data.loadAvg15,
    memUsedBytes: parsed.data.memUsedBytes,
    memTotalBytes: parsed.data.memTotalBytes,
    swapUsedBytes: parsed.data.swapUsedBytes,
    swapTotalBytes: parsed.data.swapTotalBytes,
    diskUsedBytes: parsed.data.diskUsedBytes,
    diskTotalBytes: parsed.data.diskTotalBytes,
    diskReadBps: parsed.data.diskReadBps,
    diskWriteBps: parsed.data.diskWriteBps,
    netRxBytes: parsed.data.netRxBytes,
    netTxBytes: parsed.data.netTxBytes,
    netRxBps: parsed.data.netRxBps,
    netTxBps: parsed.data.netTxBps,
    dockerCpuPercent: parsed.data.dockerCpuPercent,
    dockerMemUsedBytes: parsed.data.dockerMemUsedBytes,
    dockerNetRxBps: parsed.data.dockerNetRxBps,
    dockerNetTxBps: parsed.data.dockerNetTxBps,
    dockerContainerCount: parsed.data.dockerContainerCount,
    temperatureC: parsed.data.temperatureC,
    temperatures: parsed.data.temperatures
      ? parsed.data.temperatures
      : parsed.data.temperatureC > 0
        ? { 'Temperature': parsed.data.temperatureC }
        : undefined,
    gpuUtilPercent: parsed.data.gpuUtilPercent,
    gpuMemUsedBytes: parsed.data.gpuMemUsedBytes,
    gpuMemTotalBytes: parsed.data.gpuMemTotalBytes,
    gpuPowerWatts: parsed.data.gpuPowerWatts,
    uptimeSeconds: parsed.data.uptimeSeconds,
    processCount: parsed.data.processCount,
  });

  const appSettings = await getUserResolvedAlertSettings(agent.userId);
  const sent = await sendTelegramOverloadIfNeeded(
    agent,
    {
      cpuPercent: parsed.data.cpuPercent,
      memUsedBytes: parsed.data.memUsedBytes,
      memTotalBytes: parsed.data.memTotalBytes,
      diskUsedBytes: parsed.data.diskUsedBytes,
      diskTotalBytes: parsed.data.diskTotalBytes,
    },
    appSettings,
    env.APP_URL
  );
  if (sent) {
    agent.lastTelegramAlertAt = now;
    await agent.save();
  }

  // Find a pending command for this agent and send it
  const command = await AgentCommand.findOne({ agentId: agent.agentId, status: 'pending' });
  if (command) {
    command.status = 'sent';
    await command.save();
    return NextResponse.json({
      ok: true,
      command: {
        id: (command as any)._id.toString(),
        action: command.action,
        service: command.service,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
