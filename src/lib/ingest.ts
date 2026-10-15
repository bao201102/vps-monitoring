import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { HydratedDocument } from 'mongoose';
import { Agent, type IAgent, type IDiskMount } from './models/Agent';
import { Metric } from './models/Metric';
import { SystemService } from './models/SystemService';
import { ServiceMetric } from './models/ServiceMetric';
import { DockerContainer } from './models/DockerContainer';
import { ContainerMetric } from './models/ContainerMetric';
import { VpsPort } from './models/VpsPort';
import { VpsDomain } from './models/VpsDomain';
import { AgentCommand } from './models/AgentCommand';
import { Incident } from './models/Incident';
import { getUserResolvedAlertSettings } from './user-settings';
import {
  evaluateContainerConditions,
  evaluateHostConditions,
  evaluateServiceConditions,
  reconcileIncidents,
  resolveAgentRules,
  type Condition,
} from './alerts';

const num = z.number().finite();
const nn = num.min(0);

const serviceSchema = z.object({
  name: z.string().min(1).max(256),
  description: z.string().max(512).default(''),
  state: z.string().max(32).default('Inactive'),
  subState: z.string().max(32).default('Dead'),
  memory: nn.default(0),
  fragmentPath: z.string().max(512).nullable().optional(),
  mainPid: num.nullable().optional(),
  nRestarts: num.nullable().optional(),
  tasksCurrent: num.nullable().optional(),
  tasksMax: num.nullable().optional(),
  requires: z.array(z.string()).max(200).optional(),
  documentation: z.array(z.string()).max(50).optional(),
  unitFileState: z.string().max(32).nullable().optional(),
  loadState: z.string().max(32).nullable().optional(),
  activeEnterTimestamp: z.string().max(64).nullable().optional(),
  wants: z.array(z.string()).max(200).optional(),
  conflicts: z.array(z.string()).max(200).optional(),
  before: z.array(z.string()).max(200).optional(),
  after: z.array(z.string()).max(200).optional(),
  statusText: z.string().max(512).nullable().optional(),
  result: z.string().max(64).nullable().optional(),
  cpuUsageNSec: num.nullable().optional(),
  memoryPeak: num.nullable().optional(),
  memoryLimit: num.nullable().optional(),
  canStart: z.string().optional(),
  canStop: z.string().optional(),
  canReload: z.string().optional(),
});

const containerSchema = z.object({
  id: z.string().max(80).optional(),
  name: z.string().min(1).max(256),
  image: z.string().max(512),
  ports: z.string().max(2048).default(''),
  status: z.string().max(256).default(''),
  health: z.string().max(32).default('None'),
  cpuPercent: nn.default(0),
  memUsedBytes: nn.default(0),
  netRxBps: nn.default(0),
  netTxBps: nn.default(0),
  // Agents >= 2.0 only send logs/details every few cycles; keep the stored copy otherwise.
  logs: z.array(z.string().max(8192)).max(1000).optional(),
  details: z.record(z.any()).optional(),
});

export const heartbeatSchema = z.object({
  agentId: z.string().min(1).max(64),
  token: z.string().min(1).max(128),
  status: z.enum(['heartbeat', 'shutdown']).default('heartbeat'),
  agentVersion: z.string().max(32).optional(),
  remoteCommands: z.boolean().optional(),
  cpuPercent: nn.max(100).default(0),
  loadAvg1: nn.default(0),
  loadAvg5: nn.default(0),
  loadAvg15: nn.default(0),
  memUsedBytes: nn.default(0),
  memTotalBytes: nn.default(0),
  swapUsedBytes: nn.default(0),
  swapTotalBytes: nn.default(0),
  diskUsedBytes: nn.default(0),
  diskTotalBytes: nn.default(0),
  disks: z
    .array(
      z.object({
        mount: z.string().min(1).max(512),
        device: z.string().max(512).default(''),
        fsType: z.string().max(64).default(''),
        usedBytes: nn,
        totalBytes: nn,
      })
    )
    .max(64)
    .optional(),
  diskReadBps: nn.default(0),
  diskWriteBps: nn.default(0),
  netRxBytes: nn.default(0),
  netTxBytes: nn.default(0),
  netRxBps: nn.default(0),
  netTxBps: nn.default(0),
  dockerCpuPercent: nn.default(0),
  dockerMemUsedBytes: nn.default(0),
  dockerNetRxBps: nn.default(0),
  dockerNetTxBps: nn.default(0),
  dockerContainerCount: z.number().int().min(0).default(0),
  temperatureC: nn.default(0),
  temperatures: z.record(z.string().max(128), num).optional(),
  gpuUtilPercent: nn.max(100).default(0),
  gpuMemUsedBytes: nn.default(0),
  gpuMemTotalBytes: nn.default(0),
  gpuPowerWatts: nn.default(0),
  uptimeSeconds: nn.default(0),
  processCount: z.number().int().min(0).default(0),
  services: z.array(serviceSchema).max(2000).optional(),
  containers: z.array(containerSchema).max(500).optional(),
  ports: z
    .array(
      z.object({
        proto: z.string().max(16),
        ip: z.string().max(64),
        port: z.number().int().min(1).max(65535),
        service: z.string().max(128).default(''),
        pid: z.number().int().nullable().optional(),
      })
    )
    .max(2000)
    .optional(),
  domains: z
    .array(
      z.object({
        domain: z.string().max(255),
        type: z.string().max(32),
        target: z.string().max(512).default('static'),
      })
    )
    .max(1000)
    .optional(),
});

export type HeartbeatInput = z.infer<typeof heartbeatSchema>;
type AgentDoc = HydratedDocument<IAgent>;

const hash = (v: unknown) => createHash('sha1').update(JSON.stringify(v)).digest('hex');

export type HeartbeatResult = {
  ok: true;
  newToken?: string;
  command?: { id: string; kind: string; action: string; target: string };
};

/** Looks the agent up by its current or pending (rotated) token. */
export async function authenticateAgent(agentId: string, token: string): Promise<{ agent: AgentDoc; usedNext: boolean } | null> {
  const agent = await Agent.findOne({ agentId, $or: [{ token }, { nextToken: token }] }).exec();
  if (!agent) return null;
  return { agent, usedNext: agent.token !== token };
}

/** CPU % of the whole machine from two cumulative CPUUsageNSec readings. */
export function serviceCpuPercent(
  prevNs: number | null | undefined,
  prevAt: Date | null | undefined,
  curNs: number | null | undefined,
  now: Date,
  cores: number
): number | null {
  if (prevNs == null || curNs == null || !prevAt) return null;
  const dtNs = (now.getTime() - new Date(prevAt).getTime()) * 1e6;
  const dCpu = curNs - prevNs;
  if (dtNs <= 0 || dCpu < 0) return null;
  const pct = (dCpu / dtNs / Math.max(1, cores)) * 100;
  return Math.min(100, Math.max(0, Number(pct.toFixed(2))));
}

export async function processHeartbeat(agent: AgentDoc, usedNextToken: boolean, d: HeartbeatInput): Promise<HeartbeatResult> {
  const now = new Date();
  const agentId = agent.agentId;
  const userId = String(agent.userId);
  const settings = await getUserResolvedAlertSettings(userId);
  const rules = resolveAgentRules(agent, settings);
  const agentRef = {
    agentId,
    userId,
    hostname: agent.hostname,
    label: agent.label,
    publicIp: agent.publicIp,
  };

  if (usedNextToken) {
    agent.token = agent.nextToken!;
    agent.nextToken = null;
  }

  if (d.status === 'shutdown') {
    agent.lastSeenAt = now;
    await agent.save();
    if (rules.offlineEnabled) {
      await reconcileIncidents(agentRef, settings, ['offline'], [
        {
          type: 'offline',
          key: 'offline',
          severity: 'critical',
          title: 'Agent dừng / VPS shutdown',
          detail: 'Agent vừa gửi tín hiệu dừng. VPS có thể đang shutdown/reboot hoặc service agent bị stop.',
        },
      ], now);
    }
    return { ok: true };
  }

  const conditions: Condition[] = [];
  const evaluatedTypes: Condition['type'][] = ['offline', 'cpu', 'ram', 'disk', 'temp'];

  // ---- systemd services --------------------------------------------------
  if (d.services) {
    const existing = await SystemService.find({ agentId }).select('name cpuUsageNSec cpuPeak memoryPeak updatedAt').lean();
    const prev = new Map(existing.map((s) => [s.name, s]));
    const reported = new Set<string>();
    const ops: Parameters<typeof SystemService.bulkWrite>[0] = [];
    const history: { agentId: string; serviceName: string; ts: Date; cpuPercent: number | null; memBytes: number | null }[] = [];

    for (const s of d.services) {
      if (reported.has(s.name)) continue;
      reported.add(s.name);
      const p = prev.get(s.name);
      const running = s.subState === 'Running';
      const cpu = running
        ? serviceCpuPercent(p?.cpuUsageNSec, (p as { updatedAt?: Date } | undefined)?.updatedAt, s.cpuUsageNSec, now, agent.cpuCores)
        : null;
      const mem = s.memory > 0 ? s.memory : null;
      const memPeak = Math.max(p?.memoryPeak ?? 0, s.memoryPeak ?? 0, mem ?? 0) || null;
      const cpuPeak = cpu != null ? Math.max(p?.cpuPeak ?? 0, cpu) : p?.cpuPeak ?? null;

      if (running && (cpu != null || mem != null)) {
        history.push({ agentId, serviceName: s.name, ts: now, cpuPercent: cpu, memBytes: mem });
      }

      ops.push({
        updateOne: {
          filter: { agentId, name: s.name },
          update: {
            $set: {
              description: s.description,
              state: s.state,
              subState: s.subState,
              memory: mem,
              memoryPeak: memPeak,
              cpu10m: cpu,
              cpuPeak,
              updated: now.toISOString(),
              fragmentPath: s.fragmentPath ?? undefined,
              mainPid: s.mainPid ?? undefined,
              nRestarts: s.nRestarts ?? undefined,
              tasksCurrent: s.tasksCurrent ?? undefined,
              tasksMax: s.tasksMax ?? undefined,
              requires: s.requires,
              documentation: s.documentation,
              unitFileState: s.unitFileState ?? undefined,
              loadState: s.loadState ?? undefined,
              activeEnterTimestamp: s.activeEnterTimestamp ?? undefined,
              wants: s.wants,
              conflicts: s.conflicts,
              before: s.before,
              after: s.after,
              statusText: s.statusText ?? undefined,
              result: s.result ?? undefined,
              cpuUsageNSec: s.cpuUsageNSec ?? undefined,
              memoryLimit: s.memoryLimit ?? undefined,
              canStart: s.canStart,
              canStop: s.canStop,
              canReload: s.canReload,
            },
          },
          upsert: true,
        },
      });
    }

    await Promise.all([
      ops.length ? SystemService.bulkWrite(ops, { ordered: false }) : null,
      SystemService.deleteMany({ agentId, name: { $nin: Array.from(reported) } }),
      history.length ? ServiceMetric.insertMany(history, { ordered: false }) : null,
    ]);
    conditions.push(...evaluateServiceConditions(rules, d.services));
    evaluatedTypes.push('service');
  }

  // ---- docker containers -------------------------------------------------
  if (d.containers) {
    const names = new Set<string>();
    const ops: Parameters<typeof DockerContainer.bulkWrite>[0] = [];
    const history: { agentId: string; name: string; ts: Date; cpuPercent: number; memUsedBytes: number; netRxBps: number; netTxBps: number }[] = [];
    for (const c of d.containers) {
      if (names.has(c.name)) continue;
      names.add(c.name);
      const set: Record<string, unknown> = {
        image: c.image,
        ports: c.ports,
        status: c.status,
        health: c.health === 'Healthy' || c.health === 'Unhealthy' ? c.health : 'None',
        cpuPercent: c.cpuPercent,
        memUsedBytes: c.memUsedBytes,
        netRxBps: c.netRxBps,
        netTxBps: c.netTxBps,
      };
      if (c.id) set.containerId = c.id;
      if (c.logs) set.logs = c.logs;
      if (c.details) set.details = c.details;
      ops.push({ updateOne: { filter: { agentId, name: c.name }, update: { $set: set }, upsert: true } });
      history.push({ agentId, name: c.name, ts: now, cpuPercent: c.cpuPercent, memUsedBytes: c.memUsedBytes, netRxBps: c.netRxBps, netTxBps: c.netTxBps });
    }
    await Promise.all([
      ops.length ? DockerContainer.bulkWrite(ops, { ordered: false }) : null,
      DockerContainer.deleteMany({ agentId, name: { $nin: Array.from(names) } }),
      history.length ? ContainerMetric.insertMany(history, { ordered: false }) : null,
    ]);
    conditions.push(...evaluateContainerConditions(rules, d.containers));
    evaluatedTypes.push('container');
  } else if (d.dockerContainerCount === 0) {
    await DockerContainer.deleteMany({ agentId });
  }

  // ---- ports & domains (rewritten only when the list changed) -------------
  if (d.ports) {
    const h = hash(d.ports);
    if (h !== agent.portsHash) {
      await VpsPort.deleteMany({ agentId });
      if (d.ports.length) {
        const seen = new Set<string>();
        const rows = d.ports.filter((p) => {
          const k = `${p.proto}|${p.ip}|${p.port}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        await VpsPort.insertMany(rows.map((p) => ({ agentId, ...p })), { ordered: false });
      }
      agent.portsHash = h;
    }
  }
  if (d.domains) {
    const h = hash(d.domains);
    if (h !== agent.domainsHash) {
      await VpsDomain.deleteMany({ agentId });
      const seen = new Set<string>();
      const rows = d.domains.filter((x) => (seen.has(x.domain) ? false : (seen.add(x.domain), true)));
      if (rows.length) await VpsDomain.insertMany(rows.map((x) => ({ agentId, ...x })), { ordered: false });
      agent.domainsHash = h;
    }
  }

  // ---- host metrics ------------------------------------------------------
  const temperatures =
    d.temperatures ?? (d.temperatureC > 0 ? { Temperature: d.temperatureC } : undefined);
  const disks: IDiskMount[] =
    d.disks && d.disks.length
      ? d.disks
      : d.diskTotalBytes > 0
        ? [{ mount: '/', device: '', fsType: '', usedBytes: d.diskUsedBytes, totalBytes: d.diskTotalBytes }]
        : [];

  const latest = {
    ts: now,
    cpuPercent: d.cpuPercent,
    loadAvg1: d.loadAvg1,
    loadAvg5: d.loadAvg5,
    loadAvg15: d.loadAvg15,
    memUsedBytes: d.memUsedBytes,
    memTotalBytes: d.memTotalBytes,
    swapUsedBytes: d.swapUsedBytes,
    swapTotalBytes: d.swapTotalBytes,
    diskUsedBytes: d.diskUsedBytes,
    diskTotalBytes: d.diskTotalBytes,
    diskReadBps: d.diskReadBps,
    diskWriteBps: d.diskWriteBps,
    netRxBytes: d.netRxBytes,
    netTxBytes: d.netTxBytes,
    netRxBps: d.netRxBps,
    netTxBps: d.netTxBps,
    dockerCpuPercent: d.dockerCpuPercent,
    dockerMemUsedBytes: d.dockerMemUsedBytes,
    dockerNetRxBps: d.dockerNetRxBps,
    dockerNetTxBps: d.dockerNetTxBps,
    dockerContainerCount: d.dockerContainerCount,
    temperatureC: d.temperatureC,
    temperatures,
    gpuUtilPercent: d.gpuUtilPercent,
    gpuMemUsedBytes: d.gpuMemUsedBytes,
    gpuMemTotalBytes: d.gpuMemTotalBytes,
    gpuPowerWatts: d.gpuPowerWatts,
    uptimeSeconds: d.uptimeSeconds,
    processCount: d.processCount,
  };

  const prevCpu = typeof agent.latest?.cpuPercent === 'number' ? agent.latest.cpuPercent : null;
  const openHostKeys = new Set(
    (await Incident.find({ agentId, status: 'open', type: { $in: ['cpu', 'ram', 'disk', 'temp'] } }).select('key').lean()).map((i) => i.key)
  );
  conditions.push(
    ...evaluateHostConditions(
      rules,
      {
        cpuPercent: d.cpuPercent,
        prevCpuPercent: prevCpu,
        memUsedBytes: d.memUsedBytes,
        memTotalBytes: d.memTotalBytes,
        disks,
        temperatures: temperatures ?? {},
      },
      openHostKeys
    )
  );

  agent.latest = latest;
  agent.disks = disks;
  agent.lastSeenAt = now;
  if (d.agentVersion) agent.agentVersion = d.agentVersion;
  if (d.remoteCommands !== undefined) agent.remoteCommands = d.remoteCommands;
  if (d.memTotalBytes) agent.totalMemoryBytes = d.memTotalBytes;
  if (d.diskTotalBytes) agent.totalDiskBytes = d.diskTotalBytes;

  await Promise.all([agent.save(), Metric.create({ agentId, ...latest })]);

  // Any open "offline" incident resolves because the agent is talking to us again.
  await reconcileIncidents(agentRef, settings, evaluatedTypes, conditions, now);

  // ---- commands & token rotation ------------------------------------------
  const result: HeartbeatResult = { ok: true };
  if (agent.nextToken) result.newToken = agent.nextToken;

  if (agent.remoteCommands) {
    const cmd = await AgentCommand.findOneAndUpdate(
      { agentId, status: 'pending', expiresAt: { $gt: now } },
      { $set: { status: 'sent' } },
      { sort: { createdAt: 1 }, new: true }
    );
    if (cmd) {
      result.command = {
        id: String(cmd._id),
        kind: cmd.kind,
        action: cmd.action,
        target: cmd.target,
      };
    }
  }
  return result;
}
