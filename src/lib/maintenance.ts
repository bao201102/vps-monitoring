import mongoose from 'mongoose';
import { connectDB } from './db';
import { env } from './env';
import { Agent } from './models/Agent';
import { Metric, METRIC_AVG_FIELDS, METRIC_LAST_FIELDS } from './models/Metric';
import { MetricHourly } from './models/MetricHourly';
import { ContainerMetric } from './models/ContainerMetric';
import { SystemService } from './models/SystemService';
import { ServiceMetric } from './models/ServiceMetric';
import { DockerContainer } from './models/DockerContainer';
import { VpsPort } from './models/VpsPort';
import { VpsDomain } from './models/VpsDomain';
import { AgentCommand } from './models/AgentCommand';
import { Incident } from './models/Incident';
import { DomainCheck } from './models/DomainCheck';
import { getUserResolvedAlertSettings } from './user-settings';
import { reconcileIncidents, resolveAgentRules } from './alerts';

const DAY = 24 * 60 * 60;

type Coll = mongoose.mongo.Collection;

async function listIndexes(coll: Coll) {
  try {
    return await coll.indexes();
  } catch {
    return []; // collection does not exist yet
  }
}

/** Create (or retune) a TTL index, replacing a plain index on the same key if present. */
async function ensureTtlIndex(coll: Coll, key: Record<string, 1>, name: string, seconds: number) {
  const indexes = await listIndexes(coll);
  const current = indexes.find((i) => i.name === name);
  if (current) {
    if (current.expireAfterSeconds !== seconds) {
      await mongoose.connection.db!.command({ collMod: coll.collectionName, index: { name, expireAfterSeconds: seconds } });
    }
    return;
  }
  for (const i of indexes) {
    if (i.name !== '_id_' && JSON.stringify(i.key) === JSON.stringify(key)) {
      await coll.dropIndex(i.name!);
    }
  }
  await coll.createIndex(key, { name, expireAfterSeconds: seconds });
}

/** Indexes whose options depend on env (retention). Safe to run on every start. */
export async function ensureIndexes(): Promise<void> {
  await connectDB();
  await Promise.all([Metric.createIndexes(), MetricHourly.createIndexes(), ContainerMetric.createIndexes()]);
  await ensureTtlIndex(Metric.collection, { ts: 1 }, 'ts_ttl', env.METRICS_RETENTION_DAYS * DAY);
  await ensureTtlIndex(ContainerMetric.collection, { ts: 1 }, 'ts_ttl', env.METRICS_RETENTION_DAYS * DAY);
  await ensureTtlIndex(MetricHourly.collection, { ts: 1 }, 'ts_ttl', env.ROLLUP_RETENTION_DAYS * DAY);
}

/** One-off data fixes for documents written by older versions. Idempotent. */
export async function migrateLegacyData(): Promise<void> {
  await connectDB();
  await DockerContainer.updateMany(
    { cpuWeight: { $exists: true } },
    { $unset: { cpuWeight: 1, memWeight: 1, netWeight: 1, defaultCpu: 1, defaultMem: 1, defaultNet: 1, color: 1 } },
    { strict: false }
  );
  await Agent.updateMany(
    { $or: [{ lastTelegramAlertAt: { $exists: true } }, { lastTelegramOfflineAlertAt: { $exists: true } }] },
    { $unset: { lastTelegramAlertAt: 1, lastTelegramOfflineAlertAt: 1 } },
    { strict: false }
  );
  // Commands queued by the old UI never had a TTL or kind; expire them.
  await AgentCommand.updateMany(
    { expiresAt: { $exists: false } },
    { $set: { status: 'expired', kind: 'service', expiresAt: new Date() } },
    { strict: false }
  );
}

const hourStart = (d: Date) => new Date(Math.floor(d.getTime() / 3_600_000) * 3_600_000);

/**
 * Roll raw metrics up into hourly buckets. Re-processes the last few hours each
 * run so late heartbeats are included; on an empty rollup table it backfills
 * everything still in the raw collection.
 */
export async function rollupMetrics(now = new Date()): Promise<void> {
  await connectDB();
  const to = hourStart(now);
  const empty = (await MetricHourly.estimatedDocumentCount()) === 0;
  const from = new Date(to.getTime() - (empty ? env.METRICS_RETENTION_DAYS * DAY * 1000 : 3 * 3_600_000));

  const group: { _id: unknown; [k: string]: unknown } = {
    _id: {
      agentId: '$agentId',
      ts: { $toDate: { $subtract: [{ $toLong: '$ts' }, { $mod: [{ $toLong: '$ts' }, 3_600_000] }] } },
    },
    samples: { $sum: 1 },
    cpuMax: { $max: '$cpuPercent' },
  };
  for (const f of METRIC_AVG_FIELDS) group[f] = { $avg: `$${f}` };
  for (const f of METRIC_LAST_FIELDS) group[f] = { $last: `$${f}` };

  await Metric.aggregate([
    { $match: { ts: { $gte: from, $lt: to } } },
    { $sort: { ts: 1 } },
    { $group: group as mongoose.PipelineStage.Group['$group'] },
    { $addFields: { agentId: '$_id.agentId', ts: '$_id.ts' } },
    { $project: { _id: 0 } },
    {
      $merge: {
        into: MetricHourly.collection.collectionName,
        on: ['agentId', 'ts'],
        whenMatched: 'replace',
        whenNotMatched: 'insert',
      },
    },
  ]);
}

/** Open / resolve "offline" incidents for agents that stopped reporting. */
export async function sweepOfflineAgents(now = new Date()): Promise<void> {
  await connectDB();
  const cutoff = new Date(now.getTime() - env.AGENT_OFFLINE_AFTER_SECONDS * 1000);
  const [stale, openOffline] = await Promise.all([
    Agent.find({ lastSeenAt: { $lt: cutoff } })
      .select('agentId userId hostname label publicIp lastSeenAt alertsUseGlobal alertOfflineEnabled')
      .lean(),
    Incident.find({ type: 'offline', status: 'open' }).select('agentId').lean(),
  ]);
  const alreadyOpen = new Set(openOffline.map((i) => i.agentId));

  for (const a of stale) {
    const userId = String(a.userId);
    try {
      const settings = await getUserResolvedAlertSettings(userId);
      const rules = resolveAgentRules(a, settings);
      if (rules.offlineEnabled && alreadyOpen.has(a.agentId)) continue;
      if (!rules.offlineEnabled && !alreadyOpen.has(a.agentId)) continue;
      const mins = Math.round((now.getTime() - new Date(a.lastSeenAt!).getTime()) / 60_000);
      await reconcileIncidents(
        { agentId: a.agentId, userId, hostname: a.hostname, label: a.label, publicIp: a.publicIp },
        settings,
        ['offline'],
        rules.offlineEnabled
          ? [
              {
                type: 'offline',
                key: 'offline',
                severity: 'critical',
                title: 'VPS mất kết nối',
                detail: `Không nhận heartbeat từ ${new Date(a.lastSeenAt!).toISOString()} (khoảng ${mins} phút). Kiểm tra VPS, mạng hoặc service agent.`,
              },
            ]
          : [],
        now
      );
    } catch (e) {
      console.error('[offline-sweep]', a.agentId, e);
    }
  }
}

/** Pending commands the agent never picked up, or picked up but never answered. */
export async function expireCommands(now = new Date()): Promise<void> {
  await connectDB();
  await AgentCommand.updateMany(
    { status: 'pending', expiresAt: { $lt: now } },
    { $set: { status: 'expired', output: 'Agent did not pick up the command in time.' } }
  );
  await AgentCommand.updateMany(
    { status: 'sent', updatedAt: { $lt: new Date(now.getTime() - 5 * 60_000) } },
    { $set: { status: 'failed', output: 'No result reported by the agent.' } }
  );
}

/** Remove every document that belongs to the given agents. */
export async function deleteAgentsData(agentIds: string[]): Promise<void> {
  if (agentIds.length === 0) return;
  await connectDB();
  const q = { agentId: { $in: agentIds } };
  await Promise.all([
    Agent.deleteMany(q),
    Metric.deleteMany(q),
    MetricHourly.deleteMany(q),
    ContainerMetric.deleteMany(q),
    SystemService.deleteMany(q),
    ServiceMetric.deleteMany(q),
    DockerContainer.deleteMany(q),
    VpsPort.deleteMany(q),
    VpsDomain.deleteMany(q),
    AgentCommand.deleteMany(q),
    Incident.deleteMany(q),
    DomainCheck.deleteMany(q),
  ]);
}
