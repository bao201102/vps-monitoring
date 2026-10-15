import { NextResponse } from 'next/server';
import { clientIp, rateLimit } from './rate-limit';

/** Returns a 429 response when the caller exceeded the limit, otherwise null. */
export function limitByIp(
  req: Request,
  scope: string,
  limit: number,
  windowMs: number
): NextResponse | null {
  const r = rateLimit(`${scope}:${clientIp(req)}`, limit, windowMs);
  if (r.ok) return null;
  return NextResponse.json(
    { error: 'Too many requests, try again later.' },
    { status: 429, headers: { 'Retry-After': String(r.retryAfterSeconds) } }
  );
}

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

export function isObjectId(v: unknown): v is string {
  return typeof v === 'string' && OBJECT_ID_RE.test(v);
}
