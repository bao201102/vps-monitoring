import { connectDB } from './db';
import { AuditLog } from './models/AuditLog';
import type { SessionPayload } from './auth';

/** Records a security-relevant action. Never throws. */
export async function audit(
  actor: Pick<SessionPayload, 'sub' | 'username'>,
  action: string,
  target: string,
  meta?: Record<string, unknown>
): Promise<void> {
  try {
    await connectDB();
    await AuditLog.create({ userId: actor.sub, username: actor.username, action, target, meta, ts: new Date() });
  } catch (e) {
    console.error('[audit] failed to record', action, e);
  }
}
