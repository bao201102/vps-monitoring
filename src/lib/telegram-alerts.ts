import type { TelegramCallError, TelegramCallOk } from './telegram-client';
import { telegramSendMessageHtml } from './telegram-client';
import { formatBytes, percent } from './utils';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export type AlertSettings = {
  telegramBotToken?: string;
  telegramChatId?: string;
  telegramTopicId?: string;
  telegramCooldownSeconds: number;
  
  // Rule triggers
  alertCpuPercent: number;
  alertCpuEnabled?: boolean;
  alertRamPercent: number;
  alertRamEnabled?: boolean;
  alertDiskPercent: number;
  alertDiskEnabled?: boolean;
  alertTempLimit?: number;
  alertTempEnabled?: boolean;
  alertOfflineEnabled?: boolean;
};

export function isTelegramAlertsConfigured(settings: AlertSettings): boolean {
  return Boolean(settings.telegramBotToken && settings.telegramChatId);
}

export type HeartbeatForAlert = {
  cpuPercent: number;
  memUsedBytes: number;
  memTotalBytes: number;
  diskUsedBytes: number;
  diskTotalBytes: number;
  temperatureC: number;
  temperatures?: Record<string, number>;
};

export type AgentDisconnectReason = 'offline' | 'shutdown';

export type AgentForDisconnectAlert = {
  agentId: string;
  hostname: string;
  label?: string | null;
  publicIp?: string | null;
  lastSeenAt?: Date | string | null;
  lastTelegramOfflineAlertAt?: Date | string | null;
  
  // Alerts overrides
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

// Resolve alert thresholds based on agent overrides
export function resolveAgentAlertSettings(
  agent: AgentForDisconnectAlert,
  settings: AlertSettings
) {
  const useGlobal = agent.alertsUseGlobal !== false;
  return {
    cpuEnabled: useGlobal ? (settings.alertCpuEnabled !== false) : (agent.alertCpuEnabled !== false),
    cpuLimit: useGlobal ? settings.alertCpuPercent : (agent.alertCpuPercent ?? 85),
    ramEnabled: useGlobal ? (settings.alertRamEnabled !== false) : (agent.alertRamEnabled !== false),
    ramLimit: useGlobal ? settings.alertRamPercent : (agent.alertRamPercent ?? 85),
    diskEnabled: useGlobal ? (settings.alertDiskEnabled !== false) : (agent.alertDiskEnabled !== false),
    diskLimit: useGlobal ? settings.alertDiskPercent : (agent.alertDiskPercent ?? 90),
    tempEnabled: useGlobal ? Boolean(settings.alertTempEnabled) : Boolean(agent.alertTempEnabled),
    tempLimit: useGlobal ? (settings.alertTempLimit ?? 80) : (agent.alertTempLimit ?? 80),
    offlineEnabled: useGlobal ? (settings.alertOfflineEnabled !== false) : (agent.alertOfflineEnabled !== false),
  };
}

export function shouldSendTelegramDisconnectAlert(
  agent: AgentForDisconnectAlert,
  settings: AlertSettings
): boolean {
  const resolved = resolveAgentAlertSettings(agent, settings);
  if (!resolved.offlineEnabled) return false;

  if (!agent.lastSeenAt) return false;
  const lastSeen = new Date(agent.lastSeenAt).getTime();
  if (!Number.isFinite(lastSeen)) return false;

  const lastAlert = agent.lastTelegramOfflineAlertAt
    ? new Date(agent.lastTelegramOfflineAlertAt).getTime()
    : 0;
  return !lastAlert || lastAlert < lastSeen;
}

/**
 * Sends one Telegram message if any metric is over threshold and cooldown elapsed.
 * Does not throw — logs failures only.
 */
export async function sendTelegramOverloadIfNeeded(
  agent: {
    agentId: string;
    hostname: string;
    label?: string | null;
    publicIp?: string | null;
    lastTelegramAlertAt?: Date | null;
    
    // Alerts overrides
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
  },
  m: HeartbeatForAlert,
  settings: AlertSettings,
  appUrl: string
): Promise<boolean> {
  if (!isTelegramAlertsConfigured(settings)) return false;

  const resolved = resolveAgentAlertSettings(agent, settings);

  // Evaluate metric thresholds
  const ramPct = percent(m.memUsedBytes, m.memTotalBytes);
  const diskPct = percent(m.diskUsedBytes, m.diskTotalBytes);

  const cpuHigh = resolved.cpuEnabled && m.cpuPercent >= resolved.cpuLimit;
  const ramHigh = resolved.ramEnabled && ramPct >= resolved.ramLimit;
  const diskHigh = resolved.diskEnabled && diskPct >= resolved.diskLimit;

  // Temperature check
  let tempHigh = false;
  let triggeredSensor = '';
  let triggeredTempValue = 0;

  if (resolved.tempEnabled) {
    const temps = m.temperatures || (m.temperatureC > 0 ? { 'Temperature': m.temperatureC } : {});
    for (const [sensor, val] of Object.entries(temps)) {
      if (val >= resolved.tempLimit && val > triggeredTempValue) {
        triggeredTempValue = val;
        triggeredSensor = sensor;
        tempHigh = true;
      }
    }
  }

  if (!cpuHigh && !ramHigh && !diskHigh && !tempHigh) return false;

  const cooldownMs = settings.telegramCooldownSeconds * 1000;
  const last = agent.lastTelegramAlertAt ? new Date(agent.lastTelegramAlertAt).getTime() : 0;
  if (last && Date.now() - last < cooldownMs) return false;

  const displayName = (agent.label?.trim() || agent.hostname || agent.agentId).slice(0, 200);
  const lines: string[] = [
    `<b>⚠️ VPS Monitor — tài nguyên vượt ngưỡng</b>`,
    `<b>Máy:</b> ${escapeHtml(displayName)}`,
    `<code>${escapeHtml(agent.agentId)}</code>`,
  ];
  if (agent.publicIp) lines.push(`<b>IP:</b> <code>${escapeHtml(agent.publicIp)}</code>`);

  if (cpuHigh) {
    lines.push(`<b>CPU:</b> ${m.cpuPercent.toFixed(1)}% <i>(≥ ${resolved.cpuLimit}%)</i>`);
  }
  if (ramHigh) {
    lines.push(
      `<b>RAM:</b> ${ramPct.toFixed(1)}% — ${formatBytes(m.memUsedBytes)} / ${formatBytes(
        m.memTotalBytes
      )} <i>(≥ ${resolved.ramLimit}%)</i>`
    );
  }
  if (diskHigh) {
    lines.push(
      `<b>Ổ đĩa (/):</b> ${diskPct.toFixed(1)}% — ${formatBytes(m.diskUsedBytes)} / ${formatBytes(
        m.diskTotalBytes
      )} <i>(≥ ${resolved.diskLimit}%)</i>`
    );
  }
  if (tempHigh) {
    lines.push(
      `<b>Nhiệt độ (${escapeHtml(triggeredSensor)}):</b> ${triggeredTempValue.toFixed(1)}°C <i>(≥ ${resolved.tempLimit}°C)</i>`
    );
  }

  const base = appUrl.replace(/\/$/, '');
  const url = `${base}/servers/${encodeURIComponent(agent.agentId)}`;
  const href = url.replace(/&/g, '&amp;');
  lines.push(`<a href="${href}">Mở chi tiết trên dashboard</a>`);

  const result = await telegramSendMessageHtml(
    settings.telegramBotToken!,
    settings.telegramChatId!,
    lines.join('\n'),
    settings.telegramTopicId
  );
  if (!result.ok) {
    console.error('[telegram] sendMessage failed:', result.httpStatus, result.description);
    return false;
  }
  return true;
}

/**
 * Sends one Telegram message for each offline/shutdown incident.
 * The caller must persist lastTelegramOfflineAlertAt when this returns true.
 */
export async function sendTelegramDisconnectIfNeeded(
  agent: AgentForDisconnectAlert,
  settings: AlertSettings,
  appUrl: string,
  reason: AgentDisconnectReason
): Promise<boolean> {
  if (!isTelegramAlertsConfigured(settings)) return false;
  if (!shouldSendTelegramDisconnectAlert(agent, settings)) return false;

  const displayName = (agent.label?.trim() || agent.hostname || agent.agentId).slice(0, 200);
  const title =
    reason === 'shutdown'
      ? '⚠️ VPS Monitor — agent dừng/shutdown'
      : '⚠️ VPS Monitor — VPS mất kết nối';
  const lines: string[] = [
    `<b>${title}</b>`,
    `<b>Máy:</b> ${escapeHtml(displayName)}`,
    `<code>${escapeHtml(agent.agentId)}</code>`,
  ];
  if (agent.publicIp) lines.push(`<b>IP:</b> <code>${escapeHtml(agent.publicIp)}</code>`);
  if (agent.lastSeenAt) {
    lines.push(`<b>Lần cuối nhận heartbeat:</b> <code>${escapeHtml(new Date(agent.lastSeenAt).toISOString())}</code>`);
  }
  lines.push(
    reason === 'shutdown'
      ? 'Agent vừa gửi tín hiệu dừng. Có thể VPS đang shutdown/reboot hoặc service bị stop.'
      : 'Dashboard không nhận heartbeat trong thời gian cho phép. Kiểm tra VPS, mạng hoặc service agent.'
  );

  const base = appUrl.replace(/\/$/, '');
  const url = `${base}/servers/${encodeURIComponent(agent.agentId)}`;
  const href = url.replace(/&/g, '&amp;');
  lines.push(`<a href="${href}">Mở chi tiết trên dashboard</a>`);

  const result = await telegramSendMessageHtml(
    settings.telegramBotToken!,
    settings.telegramChatId!,
    lines.join('\n'),
    settings.telegramTopicId
  );

  if (!result.ok) {
    console.error('[telegram] sendMessage failed:', result.httpStatus, result.description);
    return false;
  }
  return true;
}

/** Sends a short test message (Settings → “Gửi tin thử”). */
export async function sendTelegramSettingsTest(settings: AlertSettings): Promise<boolean> {
  const r = await sendTelegramSettingsTestResult(settings);
  return r.ok;
}

export async function sendTelegramSettingsTestResult(
  settings: AlertSettings
): Promise<TelegramCallOk | TelegramCallError> {
  if (!isTelegramAlertsConfigured(settings)) {
    return { ok: false, httpStatus: 400, description: 'Chưa cấu hình bot token + chat id.' };
  }
  return telegramSendMessageHtml(
    settings.telegramBotToken!,
    settings.telegramChatId!,
    `<b>VPS Monitor</b>\n${escapeHtml(
      'Thử nghiệm — nếu bạn thấy tin này, bot và chat id đã đúng.'
    )}`,
    settings.telegramTopicId
  );
}
