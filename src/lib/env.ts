const DEV_FALLBACK_SECRET = 'dev-only-insecure-secret-change-me-in-production-please';

function resolveJwtSecret(): string {
  const fromEnv = process.env.JWT_SECRET;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  if (process.env.NODE_ENV === 'production') {
    // Throw lazily at request time, not at module load / build time.
    throw new Error(
      'Missing required environment variable: JWT_SECRET. Set it before starting the server.'
    );
  }
  return DEV_FALLBACK_SECRET;
}

function intFromEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = Number(process.env[name]);
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(min, Math.min(max, Math.round(raw)));
}

function boolFromEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  return raw === '1' || raw === 'true' || raw === 'yes';
}

export const env = {
  get MONGODB_URI(): string {
    return process.env.MONGODB_URI ?? 'mongodb://localhost:27017/vps-monitoring';
  },
  get JWT_SECRET(): string {
    return resolveJwtSecret();
  },
  get APP_URL(): string {
    return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  },
  get AGENT_OFFLINE_AFTER_SECONDS(): number {
    return intFromEnv('AGENT_OFFLINE_AFTER_SECONDS', 60, 15, 86_400);
  },
  /** Public self-registration. Off by default: admins create users instead. */
  get ALLOW_SIGNUP(): boolean {
    return boolFromEnv('ALLOW_SIGNUP', false);
  },
  /** Raw per-heartbeat metrics retention. */
  get METRICS_RETENTION_DAYS(): number {
    return intFromEnv('METRICS_RETENTION_DAYS', 7, 1, 90);
  },
  /** Hourly rollup retention (used by the 30d / 90d charts). */
  get ROLLUP_RETENTION_DAYS(): number {
    return intFromEnv('ROLLUP_RETENTION_DAYS', 90, 7, 730);
  },
  /** Allow webhooks / domain checks to reach private or loopback addresses. */
  get ALLOW_PRIVATE_TARGETS(): boolean {
    return boolFromEnv('ALLOW_PRIVATE_TARGETS', false);
  },
  /** Disable the in-process background jobs (e.g. when running several replicas). */
  get DISABLE_SCHEDULER(): boolean {
    return boolFromEnv('DISABLE_SCHEDULER', false);
  },
};
