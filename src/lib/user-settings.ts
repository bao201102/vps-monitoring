import { connectDB } from '@/lib/db';
import { User } from '@/lib/models/User';
import { Agent } from '@/lib/models/Agent';
import {
  sanitizeTelegramBotToken,
  sanitizeTelegramChatId,
  telegramGetMe,
  TelegramTokenRejectedError,
} from '@/lib/telegram-client';
import { parseWebhookUrl } from '@/lib/net-guard';

export class SettingsValidationError extends Error {}

export type PublicUserAlertSettings = {
  botTokenConfigured: boolean;
  telegramChatId: string;
  telegramTopicId: string;
  webhookUrl: string;
  alertCpuPercent: number;
  alertCpuEnabled: boolean;
  alertRamPercent: number;
  alertRamEnabled: boolean;
  alertDiskPercent: number;
  alertDiskEnabled: boolean;
  alertTempLimit: number;
  alertTempEnabled: boolean;
  alertOfflineEnabled: boolean;
  alertServiceEnabled: boolean;
  alertContainerEnabled: boolean;
  alertDomainEnabled: boolean;
  alertSslDays: number;
  telegramCooldownSeconds: number;
};

/** Everything the alert engine needs, including secrets. Server-side only. */
export type ResolvedAlertSettings = Omit<PublicUserAlertSettings, 'botTokenConfigured' | 'telegramChatId' | 'telegramTopicId' | 'webhookUrl'> & {
  telegramBotToken?: string;
  telegramChatId?: string;
  telegramTopicId?: string;
  webhookUrl?: string;
};

type UserDoc = {
  telegramBotToken?: string;
  telegramChatId?: string;
  telegramTopicId?: string;
  webhookUrl?: string;
  alertCpuPercent?: number;
  alertCpuEnabled?: boolean;
  alertRamPercent?: number;
  alertRamEnabled?: boolean;
  alertDiskPercent?: number;
  alertDiskEnabled?: boolean;
  alertTempLimit?: number;
  alertTempEnabled?: boolean;
  alertOfflineEnabled?: boolean;
  alertServiceEnabled?: boolean;
  alertContainerEnabled?: boolean;
  alertDomainEnabled?: boolean;
  alertSslDays?: number;
  telegramCooldownSeconds?: number;
};

function rules(user: UserDoc) {
  return {
    alertCpuPercent: user.alertCpuPercent ?? 85,
    alertCpuEnabled: user.alertCpuEnabled !== false,
    alertRamPercent: user.alertRamPercent ?? 85,
    alertRamEnabled: user.alertRamEnabled !== false,
    alertDiskPercent: user.alertDiskPercent ?? 90,
    alertDiskEnabled: user.alertDiskEnabled !== false,
    alertTempLimit: user.alertTempLimit ?? 80,
    alertTempEnabled: Boolean(user.alertTempEnabled),
    alertOfflineEnabled: user.alertOfflineEnabled !== false,
    alertServiceEnabled: user.alertServiceEnabled !== false,
    alertContainerEnabled: user.alertContainerEnabled !== false,
    alertDomainEnabled: user.alertDomainEnabled !== false,
    alertSslDays: user.alertSslDays ?? 14,
    telegramCooldownSeconds: user.telegramCooldownSeconds ?? 300,
  };
}

export async function getUserAlertSettings(userId: string): Promise<PublicUserAlertSettings> {
  await connectDB();
  const user = await User.findById(userId).lean();
  if (!user) {
    throw new Error('User not found');
  }
  return {
    botTokenConfigured: Boolean(user.telegramBotToken),
    telegramChatId: user.telegramChatId ?? '',
    telegramTopicId: user.telegramTopicId ?? '',
    webhookUrl: user.webhookUrl ?? '',
    ...rules(user),
  };
}

export type UpdateUserAppSettingsInput = {
  telegramBotToken?: string;
  clearTelegramBotToken?: boolean;
  telegramChatId?: string;
  telegramTopicId?: string;
  webhookUrl?: string;
  alertCpuPercent?: number;
  alertCpuEnabled?: boolean;
  alertRamPercent?: number;
  alertRamEnabled?: boolean;
  alertDiskPercent?: number;
  alertDiskEnabled?: boolean;
  alertTempLimit?: number;
  alertTempEnabled?: boolean;
  alertOfflineEnabled?: boolean;
  alertServiceEnabled?: boolean;
  alertContainerEnabled?: boolean;
  alertDomainEnabled?: boolean;
  alertSslDays?: number;
  telegramCooldownSeconds?: number;
};

const clampPct = (v: number) => Math.max(1, Math.min(100, Math.round(v)));

export async function updateUserAlertSettings(
  userId: string,
  input: UpdateUserAppSettingsInput
): Promise<PublicUserAlertSettings> {
  await connectDB();
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const newToken = input.telegramBotToken?.trim();
  if (newToken) {
    const clean = sanitizeTelegramBotToken(newToken);
    if (!clean.includes(':')) {
      throw new TelegramTokenRejectedError(
        'Token bot không đúng định dạng (cần dạng 123456789:AAH… từ @BotFather).'
      );
    }
    const me = await telegramGetMe(clean);
    if (!me.ok) {
      throw new TelegramTokenRejectedError(me.description);
    }
    user.telegramBotToken = clean;
  } else if (input.clearTelegramBotToken) {
    user.telegramBotToken = '';
  }

  if (input.telegramChatId !== undefined) {
    user.telegramChatId = sanitizeTelegramChatId(input.telegramChatId);
  }
  if (input.telegramTopicId !== undefined) {
    user.telegramTopicId = input.telegramTopicId.trim();
  }
  if (input.webhookUrl !== undefined) {
    const raw = input.webhookUrl.trim();
    if (raw && !parseWebhookUrl(raw)) {
      throw new SettingsValidationError('Webhook URL phải là http(s):// hợp lệ, không chứa user:password.');
    }
    user.webhookUrl = raw;
  }
  if (input.alertCpuPercent !== undefined) user.alertCpuPercent = clampPct(input.alertCpuPercent);
  if (input.alertCpuEnabled !== undefined) user.alertCpuEnabled = input.alertCpuEnabled;
  if (input.alertRamPercent !== undefined) user.alertRamPercent = clampPct(input.alertRamPercent);
  if (input.alertRamEnabled !== undefined) user.alertRamEnabled = input.alertRamEnabled;
  if (input.alertDiskPercent !== undefined) user.alertDiskPercent = clampPct(input.alertDiskPercent);
  if (input.alertDiskEnabled !== undefined) user.alertDiskEnabled = input.alertDiskEnabled;
  if (input.alertTempLimit !== undefined) {
    user.alertTempLimit = Math.max(1, Math.min(150, Math.round(input.alertTempLimit)));
  }
  if (input.alertTempEnabled !== undefined) user.alertTempEnabled = input.alertTempEnabled;
  if (input.alertOfflineEnabled !== undefined) user.alertOfflineEnabled = input.alertOfflineEnabled;
  if (input.alertServiceEnabled !== undefined) user.alertServiceEnabled = input.alertServiceEnabled;
  if (input.alertContainerEnabled !== undefined) user.alertContainerEnabled = input.alertContainerEnabled;
  if (input.alertDomainEnabled !== undefined) user.alertDomainEnabled = input.alertDomainEnabled;
  if (input.alertSslDays !== undefined) {
    user.alertSslDays = Math.max(1, Math.min(90, Math.round(input.alertSslDays)));
  }
  if (input.telegramCooldownSeconds !== undefined) {
    const c = Math.round(input.telegramCooldownSeconds);
    user.telegramCooldownSeconds = Math.max(60, Math.min(86_400, c));
  }

  await user.save();
  invalidateResolvedSettings(userId);
  return getUserAlertSettings(userId);
}

export type AgentAlertSettingsInput = {
  alertsUseGlobal: boolean;
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

export async function updateAgentAlertSettings(
  userId: string,
  agentId: string,
  input: AgentAlertSettingsInput
) {
  await connectDB();
  const agent = await Agent.findOne({ agentId, userId });
  if (!agent) {
    throw new Error('Agent not found or unauthorized');
  }

  agent.alertsUseGlobal = input.alertsUseGlobal;
  if (input.alertCpuEnabled !== undefined) agent.alertCpuEnabled = input.alertCpuEnabled;
  if (input.alertCpuPercent !== undefined) agent.alertCpuPercent = clampPct(input.alertCpuPercent);
  if (input.alertRamEnabled !== undefined) agent.alertRamEnabled = input.alertRamEnabled;
  if (input.alertRamPercent !== undefined) agent.alertRamPercent = clampPct(input.alertRamPercent);
  if (input.alertDiskEnabled !== undefined) agent.alertDiskEnabled = input.alertDiskEnabled;
  if (input.alertDiskPercent !== undefined) agent.alertDiskPercent = clampPct(input.alertDiskPercent);
  if (input.alertTempEnabled !== undefined) agent.alertTempEnabled = input.alertTempEnabled;
  if (input.alertTempLimit !== undefined) {
    agent.alertTempLimit = Math.max(1, Math.min(150, Math.round(input.alertTempLimit)));
  }
  if (input.alertOfflineEnabled !== undefined) agent.alertOfflineEnabled = input.alertOfflineEnabled;

  await agent.save();
  return agent.toObject();
}

// Heartbeats arrive every few seconds per agent; cache the user's alert settings briefly.
const RESOLVED_TTL_MS = 10_000;
const resolvedCache = new Map<string, { expiresAt: number; value: ResolvedAlertSettings }>();

export function invalidateResolvedSettings(userId: string) {
  resolvedCache.delete(String(userId));
}

export async function getUserResolvedAlertSettings(userId: string): Promise<ResolvedAlertSettings> {
  const key = String(userId);
  const hit = resolvedCache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  await connectDB();
  const user = await User.findById(key).lean();
  if (!user) {
    throw new Error('User not found');
  }
  const token = user.telegramBotToken ? sanitizeTelegramBotToken(user.telegramBotToken) : '';
  const chat = user.telegramChatId ? sanitizeTelegramChatId(user.telegramChatId) : '';
  const value: ResolvedAlertSettings = {
    telegramBotToken: token || undefined,
    telegramChatId: chat || undefined,
    telegramTopicId: user.telegramTopicId?.trim() || undefined,
    webhookUrl: user.webhookUrl?.trim() || undefined,
    ...rules(user),
  };
  resolvedCache.set(key, { expiresAt: Date.now() + RESOLVED_TTL_MS, value });
  return value;
}
