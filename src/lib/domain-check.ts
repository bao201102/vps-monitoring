import tls from 'node:tls';
import { connectDB } from './db';
import { Agent } from './models/Agent';
import { VpsDomain } from './models/VpsDomain';
import { DomainCheck } from './models/DomainCheck';
import { assertPublicHost, BlockedTargetError } from './net-guard';
import { getUserResolvedAlertSettings } from './user-settings';
import { reconcileIncidents, resolveAgentRules, type Condition } from './alerts';

const DOMAIN_RE = /^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/i;

export function isCheckableDomain(d: string): boolean {
  return DOMAIN_RE.test(d) && !/^\d+(\.\d+){3}$/.test(d);
}

type TlsInfo = { validTo: Date; issuer: string; authorized: boolean; error?: string };

function readCertificate(host: string, timeoutMs = 8000): Promise<TlsInfo | null> {
  return new Promise((resolve) => {
    const socket = tls.connect({ host, port: 443, servername: host, rejectUnauthorized: false, timeout: timeoutMs });
    const done = (v: TlsInfo | null) => {
      socket.destroy();
      resolve(v);
    };
    socket.once('secureConnect', () => {
      const cert = socket.getPeerCertificate();
      if (!cert || !cert.valid_to) return done(null);
      const issuer = cert.issuer ? String(cert.issuer.O ?? cert.issuer.CN ?? '') : '';
      done({
        validTo: new Date(cert.valid_to),
        issuer,
        authorized: socket.authorized,
        error: socket.authorizationError ? String(socket.authorizationError) : undefined,
      });
    });
    socket.once('timeout', () => done(null));
    socket.once('error', () => done(null));
  });
}

export type ProbeResult = {
  ok: boolean;
  httpStatus: number | null;
  responseMs: number | null;
  error: string | null;
  sslValidTo: Date | null;
  sslIssuer: string | null;
};

export async function probeDomain(domain: string): Promise<ProbeResult> {
  try {
    await assertPublicHost(domain);
  } catch (e) {
    const msg = e instanceof BlockedTargetError ? 'Bỏ qua: domain trỏ về địa chỉ nội bộ' : `DNS: ${(e as Error).message}`;
    return { ok: false, httpStatus: null, responseMs: null, error: msg, sslValidTo: null, sslIssuer: null };
  }

  const cert = await readCertificate(domain);
  const url = cert ? `https://${domain}/` : `http://${domain}/`;
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      headers: { 'User-Agent': 'vps-monitor-domain-check' },
      signal: AbortSignal.timeout(10_000),
    });
    await res.body?.cancel().catch(() => undefined);
    const ok = res.status < 500 && (!cert || cert.authorized);
    return {
      ok,
      httpStatus: res.status,
      responseMs: Date.now() - started,
      error: cert && !cert.authorized ? `TLS: ${cert.error ?? 'certificate not trusted'}` : res.status >= 500 ? `HTTP ${res.status}` : null,
      sslValidTo: cert?.validTo ?? null,
      sslIssuer: cert?.issuer ?? null,
    };
  } catch (e) {
    const cause = (e as { cause?: { code?: string; message?: string } }).cause;
    return {
      ok: false,
      httpStatus: null,
      responseMs: null,
      error: cause?.code ?? cause?.message ?? (e as Error).message,
      sslValidTo: cert?.validTo ?? null,
      sslIssuer: cert?.issuer ?? null,
    };
  }
}

async function mapLimit<T>(items: T[], limit: number, fn: (t: T) => Promise<void>) {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const item = items[i++];
      await fn(item).catch((e) => console.error('[domain-check]', e));
    }
  });
  await Promise.all(workers);
}

/** Probe every discovered domain of agents seen in the last day and reconcile incidents. */
export async function runDomainChecks(now = new Date()): Promise<void> {
  await connectDB();
  const agents = await Agent.find({ lastSeenAt: { $gte: new Date(now.getTime() - 24 * 3_600_000) } })
    .select('agentId userId hostname label publicIp alertsUseGlobal')
    .lean();

  for (const a of agents) {
    const domains = (await VpsDomain.find({ agentId: a.agentId }).select('domain').lean())
      .map((d) => d.domain.toLowerCase())
      .filter(isCheckableDomain);
    const unique = Array.from(new Set(domains)).slice(0, 50);
    await DomainCheck.deleteMany({ agentId: a.agentId, domain: { $nin: unique } });

    const previous = new Map(
      (await DomainCheck.find({ agentId: a.agentId }).lean()).map((c) => [c.domain, c])
    );
    const conditions: Condition[] = [];
    const settings = await getUserResolvedAlertSettings(String(a.userId));
    const rules = resolveAgentRules(a, settings);

    await mapLimit(unique, 4, async (domain) => {
      const r = await probeDomain(domain);
      await DomainCheck.updateOne(
        { agentId: a.agentId, domain },
        { $set: { ...r, checkedAt: now } },
        { upsert: true }
      );
      if (!rules.domainEnabled) return;
      const prev = previous.get(domain);
      const skipped = r.error?.startsWith('Bỏ qua');
      // Two failed checks in a row before paging, to ride out blips.
      if (!r.ok && !skipped && prev && !prev.ok) {
        conditions.push({
          type: 'domain_down',
          key: `domain:${domain}`,
          severity: 'critical',
          title: `${domain} không truy cập được`,
          detail: `${domain}: ${r.error ?? `HTTP ${r.httpStatus}`}`,
        });
      }
      if (r.sslValidTo) {
        const days = Math.floor((r.sslValidTo.getTime() - now.getTime()) / 86_400_000);
        if (days < rules.sslDays) {
          conditions.push({
            type: 'ssl_expiry',
            key: `ssl:${domain}`,
            severity: days <= 3 ? 'critical' : 'warning',
            title: `SSL ${domain} sắp hết hạn`,
            detail: days < 0 ? `Chứng chỉ của ${domain} đã hết hạn.` : `Chứng chỉ của ${domain} còn ${days} ngày (hết hạn ${r.sslValidTo.toISOString().slice(0, 10)}).`,
            value: days,
            threshold: rules.sslDays,
          });
        }
      }
    });

    await reconcileIncidents(
      { agentId: a.agentId, userId: String(a.userId), hostname: a.hostname, label: a.label, publicIp: a.publicIp },
      settings,
      ['domain_down', 'ssl_expiry'],
      conditions,
      now
    );
  }
}
