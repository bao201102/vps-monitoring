import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { env } from './env';
import { connectDB } from './db';
import { User } from './models/User';

const COOKIE_NAME = 'vpsmon_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

const getSecret = (): Uint8Array => new TextEncoder().encode(env.JWT_SECRET);

export interface SessionPayload {
  sub: string;
  username: string;
  role: 'admin' | 'user';
}

interface TokenPayload {
  sub: string;
  sv: number;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * The token only identifies the user (+ session version). Role and username are
 * always re-read from the database so role changes / deletions apply immediately.
 */
export async function signSession(user: { _id: { toString(): string }; sessionVersion?: number }): Promise<string> {
  return new SignJWT({ sv: user.sessionVersion ?? 0 })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user._id.toString())
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSecret());
}

async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (!payload.sub) return null;
    return { sub: String(payload.sub), sv: Number((payload as Record<string, unknown>).sv ?? 0) };
  } catch {
    return null;
  }
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  const t = await verifyToken(token);
  if (!t) return null;
  await connectDB();
  const user = await User.findById(t.sub).select('username role sessionVersion').lean().catch(() => null);
  if (!user) return null;
  if ((user.sessionVersion ?? 0) !== t.sv) return null;
  return {
    sub: String(user._id),
    username: user.username,
    role: user.role === 'admin' ? 'admin' : 'user',
  };
}

export async function setSessionCookie(token: string): Promise<void> {
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' && env.APP_URL.startsWith('https://'),
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
}

export function clearSessionCookie(): void {
  cookies().set(COOKIE_NAME, '', { path: '/', maxAge: 0 });
}

export async function getSessionFromCookies(): Promise<SessionPayload | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

/** Convenience for admin-only API routes. */
export async function requireAdmin(): Promise<SessionPayload | null> {
  const s = await getSessionFromCookies();
  return s && s.role === 'admin' ? s : null;
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
