import { env } from './env';
import { Incident, type IncidentSeverity, type IncidentType } from './models/Incident';
import { formatBytes, percent } from './utils';
import { hasNotificationChannel, notify } from './notify';
import type { ResolvedAlertSettings } from './user-settings';

/** A problem currently observed on an agent. Becomes / keeps an open incident. */
export type Condition = {
  type: IncidentType;
  key: string;
  severity: IncidentSeverity;
  title: string;
  detail: string;
  value?: number | null;
  threshold?: number | null;
};

export type AgentAlertOverrides = {
  alertsUseGlobal?: boolean;
  alertCpuEnabled?: boolean;
  alertCpuPercent?: number;
  alertRamEnabled?: boolean;
  alertRamPercent?: number;
  alertDiskEnabled?: boolean;
  alertDiskPercent?: number;
  alertTempEnabled?: boolean;
  alertTempLimit?: number;
  alertOfflineEnabled?: boolean;
};

export type AgentRules = ReturnType<typeof resolveAgentRules>;

/** Per-agent overrides win over the user's global rules when alertsUseGlobal is false. */
export function resolveAgentRules(agent: AgentAlertOverrides, s: ResolvedAlertSettings) {
  const g = agent.alertsUseGlobal !== false;
  return {
    cpuEnabled: g ? s.alertCpuEnabled : agent.alertCpuEnabled !== false,
    cpuLimit: g ? s.alertCpuPercent : agent.alertCpuPercent ?? 85,
    ramEnabled: g ? s.alertRamEnabled : agent.alertRamEnabled !== false,
    ramLimit: g ? s.alertRamPercent : agent.alertRamPercent ?? 85,
    diskEnabled: g ? s.alertDiskEnabled : agent.alertDiskEnabled !== false,
    diskLimit: g ? s.alertDiskPercent : agent.alertDiskPercent ?? 90,
    tempEnabled: g ? s.alertTempEnabled : Boolean(agent.alertTempEnabled),
    tempLimit: g ? s.alertTempLimit : agent.alertTempLimit ?? 80,
    offlineEnabled: g ? s.alertOfflineEnabled : agent.alertOfflineEnabled !== false,
    serviceEnabled: s.alertServiceEnabled,
    containerEnabled: s.alertContainerEnabled,
    domainEnabled: s.alertDomainEnabled,
    sslDays: s.alertSslDays,
  };
}

/** Percentage points a metric must drop below the limit before an incident resolves. */
export const HYSTERESIS = 5;

export type HostSnapshot = {
  cpuPercent: number;
  /** CPU of the previous heartbeat: CPU alerts need two samples in a row to avoid spikes. */
  prevCpuPercent?: number | null;
  memUsedBytes: number;
  memTotalBytes: number;
  disks: { mount: string; usedBytes: number; totalBytes: number }[];
  temperatures: Record<string, number>;
};

export function evaluateHostConditions(rules: AgentRules, m: HostSnapshot, openKeys: Set<string>): Condition[] {
  const out: Condition[] = [];
  const over = (key: string, value: number, limit: number, needsSecond = false, prev?: number | null) => {
    if (openKeys.has(key)) return value >= limit - HYSTERESIS;
    if (value < limit) return false;
    return !needsSecond || prev == null || prev >= limit;
  };

  if (rules.cpuEnabled && over('cpu', m.cpuPercent, rules.cpuLimit, true, m.prevCpuPercent)) {
    out.push({
      type: 'cpu',
      key: 'cpu',
      severity: m.cpuPercent >= 98 ? 'critical' : 'warning',
      title: 'CPU cao',
      detail: `CPU ${m.cpuPercent.toFixed(1)}% (ngưỡng ${rules.cpuLimit}%)`,
      value: m.cpuPercent,
      threshold: rules.cpuLimit,
    });
  }

  const ramPct = percent(m.memUsedBytes, m.memTotalBytes);
  if (rules.ramEnabled && m.memTotalBytes > 0 && over('ram', ramPct, rules.ramLimit)) {
    out.push({
      type: 'ram',
      key: 'ram',
      severity: ramPct >= 97 ? 'critical' : 'warning',
      title: 'RAM cao',
      detail: `RAM ${ramPct.toFixed(1)}% — ${formatBytes(m.memUsedBytes)} / ${formatBytes(m.memTotalBytes)} (ngưỡng ${rules.ramLimit}%)`,
      value: ramPct,
      threshold: rules.ramLimit,
    });
  }

  if (rules.diskEnabled) {
    for (const d of m.disks) {
      if (!d.totalBytes) continue;
      const pct = percent(d.usedBytes, d.totalBytes);
      const key = `disk:${d.mount}`;
      if (over(key, pct, rules.diskLimit)) {
        out.push({
          type: 'disk',
          key,
          severity: pct >= 97 ? 'critical' : 'warning',
          title: `Ổ đĩa ${d.mount} sắp đầy`,
          detail: `${d.mount}: ${pct.toFixed(1)}% — ${formatBytes(d.usedBytes)} / ${formatBytes(d.totalBytes)} (ngưỡng ${rules.diskLimit}%)`,
          value: pct,
          threshold: rules.diskLimit,
        });
      }
    }
  }

  if (rules.tempEnabled) {
    let sensor = '';
    let max = 0;
    for (const [k, v] of Object.entries(m.temperatures)) {
      if (v > max) {
        max = v;
        sensor = k;
      }
    }
    if (sensor && over('temp', max, rules.tempLimit)) {
      out.push({
        type: 'temp',
        key: 'temp',
        severity: 'warning',
        title: 'Nhiệt độ cao',
        detail: `${sensor}: ${max.toFixed(1)}°C (ngưỡng ${rules.tempLimit}°C)`,
        value: max,
        threshold: rules.tempLimit,
      });
    }
  }
  return out;
}

export function evaluateServiceConditions(
  rules: AgentRules,
  services: { name: string; state: string; subState: string; result?: string | null }[]
): Condition[] {
  if (!rules.serviceEnabled) return [];
  return services
    .filter((s) => s.state === 'Failed' || s.subState === 'Failed')
    .map((s) => ({
      type: 'service' as const,
      key: `service:${s.name}`,
      severity: 'critical' as const,
      title: `Service ${s.name} lỗi`,
      detail: `systemd báo ${s.name} ở trạng thái failed${s.result ? ` (result: ${s.result})` : ''}.`,
    }));
}

/** Unhealthy, crash-looping or exited with a non-zero code. `Exited (0)` is a deliberate stop. */
export function isContainerProblem(status: string, health: string): string | null {
  if (health === 'Unhealthy') return 'healthcheck unhealthy';
  if (/^Restarting/i.test(status)) return 'đang restart liên tục';
  const m = status.match(/^Exited \((\d+)\)/i);
  if (m && m[1] !== '0') return `đã dừng với mã lỗi ${m[1]}`;
  if (/^Dead/i.test(status)) return 'trạng thái dead';
  return null;
}

export function evaluateContainerConditions(
  rules: AgentRules,
  containers: { name: string; status: string; health: string }[]
): Condition[] {
  if (!rules.containerEnabled) return [];
  const out: Condition[] = [];
  for (const c of containers) {
    const problem = isContainerProblem(c.status, c.health);
    if (!problem) continue;
    out.push({
      type: 'container',
      key: `container:${c.name}`,
      severity: 'warning',
      title: `Container ${c.name} có vấn đề`,
      detail: `${c.name}: ${problem} (${c.status}).`,
    });
  }
  return out;
}

export type AgentRef = {
  agentId: string;
  userId: string;
  hostname?: string | null;
  label?: string | null;
  publicIp?: string | null;
};

export function agentDisplayName(a: Pick<AgentRef, 'agentId' | 'hostname' | 'label'>) {
  return (a.label?.trim() || a.hostname || a.agentId).slice(0, 200);
}

export function agentUrl(agentId: string, tab?: string) {
  const base = env.APP_URL.replace(/\/$/, '');
  return `${base}/servers/${encodeURIComponent(agentId)}${tab ? `?tab=${tab}` : ''}`;
}

const TAB_FOR_TYPE: Partial<Record<IncidentType, string>> = {
  service: 'service',
  container: 'containers',
  domain_down: 'ports',
  ssl_expiry: 'ports',
  disk: 'disk',
};

/**
 * Make the open incidents of `types` for this agent match `conditions`:
 * new problems open an incident (and notify), vanished ones resolve (and notify).
 * A problem that comes back within the cooldown silently reopens the previous
 * incident instead of paging again (flap protection).
 */
export async function reconcileIncidents(
  agent: AgentRef,
  settings: ResolvedAlertSettings,
  types: readonly IncidentType[],
  conditions: Condition[],
  now = new Date()
): Promise<void> {
  const open = await Incident.find({ agentId: agent.agentId, status: 'open', type: { $in: types } }).lean();
  const openByKey = new Map(open.map((i) => [i.key, i]));
  const activeByKey = new Map(conditions.map((c) => [c.key, c]));
  const canNotify = hasNotificationChannel(settings);
  const cooldownMs = settings.telegramCooldownSeconds * 1000;
  const serverName = agentDisplayName(agent);
  const ipLine = agent.publicIp ? [`IP: ${agent.publicIp}`] : [];

  for (const c of conditions) {
    const existing = openByKey.get(c.key);
    if (existing) {
      if (existing.value !== (c.value ?? null) || existing.detail !== c.detail) {
        await Incident.updateOne({ _id: existing._id }, { $set: { value: c.value ?? null, detail: c.detail, severity: c.severity } });
      }
      continue;
    }

    const recent = await Incident.findOne({
      agentId: agent.agentId,
      key: c.key,
      status: 'resolved',
      resolvedAt: { $gte: new Date(now.getTime() - cooldownMs) },
    }).sort({ resolvedAt: -1 });

    if (recent) {
      recent.set({ status: 'open', resolvedAt: null, detail: c.detail, value: c.value ?? null, severity: c.severity });
      await recent.save().catch(ignoreDuplicate);
      continue;
    }

    try {
      const inc = await Incident.create({
        userId: agent.userId,
        agentId: agent.agentId,
        type: c.type,
        key: c.key,
        status: 'open',
        severity: c.severity,
        title: c.title,
        detail: c.detail,
        value: c.value ?? null,
        threshold: c.threshold ?? null,
        startedAt: now,
      });
      if (canNotify) {
        await notify(settings, {
          phase: 'open',
          severity: c.severity,
          title: c.title,
          serverName,
          lines: [c.detail, ...ipLine],
          url: agentUrl(agent.agentId, TAB_FOR_TYPE[c.type]),
          agentId: agent.agentId,
          incidentType: c.type,
          incidentKey: c.key,
        });
        await Incident.updateOne({ _id: inc._id }, { $set: { notifiedAt: new Date() } });
      }
    } catch (e) {
      ignoreDuplicate(e);
    }
  }

  for (const inc of open) {
    if (activeByKey.has(inc.key)) continue;
    const res = await Incident.updateOne(
      { _id: inc._id, status: 'open' },
      { $set: { status: 'resolved', resolvedAt: now } }
    );
    if (res.modifiedCount && inc.notifiedAt && canNotify) {
      const mins = Math.max(1, Math.round((now.getTime() - new Date(inc.startedAt).getTime()) / 60_000));
      await notify(settings, {
        phase: 'resolved',
        severity: 'info',
        title: `Đã ổn định: ${inc.title}`,
        serverName,
        lines: [`Kéo dài khoảng ${mins} phút.`, ...ipLine],
        url: agentUrl(agent.agentId, TAB_FOR_TYPE[inc.type]),
        agentId: agent.agentId,
        incidentType: inc.type,
        incidentKey: inc.key,
      });
    }
  }
}

function ignoreDuplicate(e: unknown) {
  const code = typeof e === 'object' && e !== null && 'code' in e ? (e as { code: number }).code : 0;
  if (code !== 11_000) throw e;
}
