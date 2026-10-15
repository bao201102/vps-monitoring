import { telegramSendMessageHtml } from './telegram-client';
import { assertPublicHost, parseWebhookUrl } from './net-guard';
import type { ResolvedAlertSettings } from './user-settings';

export type NotificationEvent = {
  /** `open` = problem started, `resolved` = back to normal, `test` = settings test. */
  phase: 'open' | 'resolved' | 'test';
  severity: 'warning' | 'critical' | 'info';
  title: string;
  /** Plain-text lines, rendered as-is in webhook payloads and escaped for Telegram. */
  lines: string[];
  url?: string;
  agentId?: string;
  serverName?: string;
  incidentType?: string;
  incidentKey?: string;
};

export type ChannelResult = { channel: 'telegram' | 'webhook'; ok: boolean; error?: string };

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function hasNotificationChannel(s: Pick<ResolvedAlertSettings, 'telegramBotToken' | 'telegramChatId' | 'webhookUrl'>) {
  return Boolean((s.telegramBotToken && s.telegramChatId) || s.webhookUrl);
}

function icon(e: NotificationEvent) {
  if (e.phase === 'resolved') return '✅';
  if (e.phase === 'test') return 'ℹ️';
  return e.severity === 'critical' ? '🔴' : '⚠️';
}

function toTelegramHtml(e: NotificationEvent): string {
  const out = [`<b>${icon(e)} ${escapeHtml(e.title)}</b>`];
  if (e.serverName) out.push(`<b>Máy:</b> ${escapeHtml(e.serverName)}`);
  for (const l of e.lines) out.push(escapeHtml(l));
  if (e.url) out.push(`<a href="${e.url.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">Mở trên dashboard</a>`);
  return out.join('\n');
}

function toPlainText(e: NotificationEvent): string {
  const out = [`${icon(e)} ${e.title}`];
  if (e.serverName) out.push(`Máy: ${e.serverName}`);
  out.push(...e.lines);
  if (e.url) out.push(e.url);
  return out.join('\n');
}

async function sendWebhook(rawUrl: string, e: NotificationEvent): Promise<ChannelResult> {
  const url = parseWebhookUrl(rawUrl);
  if (!url) return { channel: 'webhook', ok: false, error: 'Invalid webhook URL' };
  try {
    await assertPublicHost(url.hostname);
    const text = toPlainText(e);
    // `text` works for Slack/Mattermost/Google Chat, `content` for Discord; `event` for custom receivers.
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'vps-monitor' },
      body: JSON.stringify({ text, content: text.slice(0, 2000), event: { ...e, sentAt: new Date().toISOString() } }),
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status >= 200 && res.status < 300) return { channel: 'webhook', ok: true };
    return { channel: 'webhook', ok: false, error: `HTTP ${res.status}` };
  } catch (err) {
    return { channel: 'webhook', ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Fan out to every configured channel. Never throws. */
export async function notify(settings: ResolvedAlertSettings, e: NotificationEvent): Promise<ChannelResult[]> {
  const jobs: Promise<ChannelResult>[] = [];
  if (settings.telegramBotToken && settings.telegramChatId) {
    jobs.push(
      telegramSendMessageHtml(settings.telegramBotToken, settings.telegramChatId, toTelegramHtml(e), settings.telegramTopicId).then(
        (r) => (r.ok ? { channel: 'telegram' as const, ok: true } : { channel: 'telegram' as const, ok: false, error: r.description })
      )
    );
  }
  if (settings.webhookUrl) jobs.push(sendWebhook(settings.webhookUrl, e));
  const results = await Promise.all(jobs);
  for (const r of results) {
    if (!r.ok) console.error(`[notify] ${r.channel} failed:`, r.error);
  }
  return results;
}
