import { randomBytes } from 'node:crypto';
import { connectDB } from './db';
import { User } from './models/User';

const ENROLL_RE = /^enr_[A-Za-z0-9_-]{32,64}$/;

function newEnrollToken(): string {
  return `enr_${randomBytes(24).toString('base64url')}`;
}

export function isEnrollTokenShape(v: unknown): v is string {
  return typeof v === 'string' && ENROLL_RE.test(v);
}

/** Returns the user's enrollment token, creating one on first use. */
export async function getOrCreateEnrollToken(userId: string): Promise<string> {
  await connectDB();
  const user = await User.findById(userId).select('enrollToken').lean();
  if (!user) throw new Error('User not found');
  if (user.enrollToken) return user.enrollToken;
  const token = newEnrollToken();
  // Only set if still empty (two tabs opening "Add server" at once).
  const updated = await User.findOneAndUpdate(
    { _id: userId, $or: [{ enrollToken: { $exists: false } }, { enrollToken: '' }, { enrollToken: null }] },
    { $set: { enrollToken: token } },
    { new: true }
  ).lean();
  if (updated?.enrollToken) return updated.enrollToken;
  const again = await User.findById(userId).select('enrollToken').lean();
  return again?.enrollToken ?? token;
}

/** Issues a new enrollment token; old install commands stop working. Installed agents are unaffected. */
export async function rotateEnrollToken(userId: string): Promise<string> {
  await connectDB();
  const token = newEnrollToken();
  await User.updateOne({ _id: userId }, { $set: { enrollToken: token } });
  return token;
}

export async function findUserByEnrollToken(token: string) {
  if (!isEnrollTokenShape(token)) return null;
  await connectDB();
  return User.findOne({ enrollToken: token }).select('_id username').lean();
}
