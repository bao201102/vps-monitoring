import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { connectDB } from './db';
import { env } from './env';
import {
  ensureIndexes,
  expireCommands,
  migrateLegacyData,
  rollupMetrics,
  sweepOfflineAgents,
} from './maintenance';
import { runDomainChecks } from './domain-check';

const OWNER = randomUUID();

/**
 * Lease lock in Mongo so that only one replica runs a given job per period.
 * Returns false when another process holds the lease.
 */
async function acquireLease(name: string, ttlMs: number): Promise<boolean> {
  await connectDB();
  const locks = mongoose.connection.collection<{ _id: string; owner: string; until: Date }>('locks');
  const now = new Date();
  try {
    const res = await locks.findOneAndUpdate(
      { _id: name, $or: [{ until: { $lt: now } }, { owner: OWNER }] },
      { $set: { owner: OWNER, until: new Date(now.getTime() + ttlMs) } },
      { upsert: true, returnDocument: 'after' }
    );
    return res?.owner === OWNER;
  } catch (e) {
    const code = typeof e === 'object' && e !== null && 'code' in e ? (e as { code: number }).code : 0;
    if (code === 11_000) return false; // someone else holds it
    throw e;
  }
}

type Job = { name: string; everyMs: number; run: () => Promise<void> };

const JOBS: Job[] = [
  { name: 'offline-sweep', everyMs: 30_000, run: () => sweepOfflineAgents() },
  { name: 'expire-commands', everyMs: 60_000, run: () => expireCommands() },
  { name: 'rollup-metrics', everyMs: 15 * 60_000, run: () => rollupMetrics() },
  { name: 'domain-checks', everyMs: 10 * 60_000, run: () => runDomainChecks() },
];

declare global {
  // eslint-disable-next-line no-var
  var __vpsmonScheduler: boolean | undefined;
}

export function startScheduler(): void {
  if (env.DISABLE_SCHEDULER || global.__vpsmonScheduler) return;
  global.__vpsmonScheduler = true;

  const running = new Set<string>();
  const tick = async (job: Job) => {
    if (running.has(job.name)) return;
    running.add(job.name);
    try {
      if (await acquireLease(job.name, Math.max(job.everyMs - 2_000, 10_000))) {
        await job.run();
      }
    } catch (e) {
      console.error(`[scheduler] ${job.name} failed:`, e);
    } finally {
      running.delete(job.name);
    }
  };

  (async () => {
    try {
      await ensureIndexes();
      await migrateLegacyData();
    } catch (e) {
      console.error('[scheduler] startup maintenance failed:', e);
    }
    for (const job of JOBS) {
      setTimeout(() => void tick(job), 5_000);
      setInterval(() => void tick(job), job.everyMs).unref();
    }
    console.log('[scheduler] background jobs started');
  })();
}
