import { lookup } from 'node:dns/promises';
import net from 'node:net';
import { env } from './env';

/**
 * Outbound requests to user-controlled hosts (webhooks, domain checks) must not
 * reach the dashboard's own network (SSRF). Set ALLOW_PRIVATE_TARGETS=true to
 * opt out, e.g. for a LAN-only deployment.
 */
export function isPrivateAddress(ip: string): boolean {
  const v = net.isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) || // CGNAT
      (a === 169 && b === 254) || // link-local / cloud metadata
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224 // multicast + reserved
    );
  }
  if (v === 6) {
    const s = ip.toLowerCase();
    if (s === '::' || s === '::1') return true;
    if (s.startsWith('::ffff:')) return isPrivateAddress(s.slice(7));
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(s);
  }
  return true;
}

export class BlockedTargetError extends Error {}

/** Throws BlockedTargetError when the hostname resolves to a private address. */
export async function assertPublicHost(hostname: string): Promise<void> {
  if (env.ALLOW_PRIVATE_TARGETS) return;
  const host = hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new BlockedTargetError(`Refusing to contact private host ${hostname}`);
  }
  const addrs = net.isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (addrs.length === 0 || addrs.some((a) => isPrivateAddress(a.address))) {
    throw new BlockedTargetError(`Refusing to contact private address for ${hostname}`);
  }
}

/** Basic shape check for webhook URLs (http/https, no credentials). */
export function parseWebhookUrl(raw: string): URL | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (u.username || u.password) return null;
    return u;
  } catch {
    return null;
  }
}
