import { connectDB } from '@/lib/db';
import { User } from '@/lib/models/User';
import { Agent } from '@/lib/models/Agent';
import {
  sanitizeTelegramBotToken,
  sanitizeTelegramChatId,
  telegramGetMe,
  TelegramTokenRejectedError,
} from '@/lib/telegram-client';

export type PublicUserAlertSettings = {
  botTokenConfigured: boolean;
  telegramChatId: string;
  telegramTopicId: string;
  alertCpuPercent: number;
  alertCpuEnabled: boolean;
  alertRamPercent: number;
  alertRamEnabled: boolean;
  alertDiskPercent: number;
  alertDiskEnabled: boolean;
  alertTempLimit: number;
  alertTempEnabled: boolean;
  alertOfflineEnabled: boolean;
  telegramCooldownSeconds: number;
};

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
    alertCpuPercent: user.alertCpuPercent ?? 85,
    alertCpuEnabled: user.alertCpuEnabled !== false,
    alertRamPercent: user.alertRamPercent ?? 85,
    alertRamEnabled: user.alertRamEnabled !== false,
    alertDiskPercent: user.alertDiskPercent ?? 90,
    alertDiskEnabled: user.alertDiskEnabled !== false,
    alertTempLimit: user.alertTempLimit ?? 80,
    alertTempEnabled: Boolean(user.alertTempEnabled),
    alertOfflineEnabled: user.alertOfflineEnabled !== false,
    telegramCooldownSeconds: user.telegramCooldownSeconds ?? 300,
  };
}

export type UpdateUserAppSettingsInput = {
  telegramBotToken?: string;
  clearTelegramBotToken?: boolean;
  telegramChatId?: string;
  telegramTopicId?: string;
  alertCpuPercent?: number;
  alertCpuEnabled?: boolean;
  alertRamPercent?: number;
  alertRamEnabled?: boolean;
  alertDiskPercent?: number;
  alertDiskEnabled?: boolean;
  alertTempLimit?: number;
  alertTempEnabled?: boolean;
  alertOfflineEnabled?: boolean;
  telegramCooldownSeconds?: number;
};

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
  if (input.alertCpuPercent !== undefined) {
    user.alertCpuPercent = Math.max(1, Math.min(100, Math.round(input.alertCpuPercent)));
  }
  if (input.alertCpuEnabled !== undefined) {
    user.alertCpuEnabled = input.alertCpuEnabled;
  }
  if (input.alertRamPercent !== undefined) {
    user.alertRamPercent = Math.max(1, Math.min(100, Math.round(input.alertRamPercent)));
  }
  if (input.alertRamEnabled !== undefined) {
    user.alertRamEnabled = input.alertRamEnabled;
  }
  if (input.alertDiskPercent !== undefined) {
    user.alertDiskPercent = Math.max(1, Math.min(100, Math.round(input.alertDiskPercent)));
  }
  if (input.alertDiskEnabled !== undefined) {
    user.alertDiskEnabled = input.alertDiskEnabled;
  }
  if (input.alertTempLimit !== undefined) {
    user.alertTempLimit = Math.max(1, Math.min(150, Math.round(input.alertTempLimit)));
  }
  if (input.alertTempEnabled !== undefined) {
    user.alertTempEnabled = input.alertTempEnabled;
  }
  if (input.alertOfflineEnabled !== undefined) {
    user.alertOfflineEnabled = input.alertOfflineEnabled;
  }
  if (input.telegramCooldownSeconds !== undefined) {
    const c = Math.round(input.telegramCooldownSeconds);
    user.telegramCooldownSeconds = Math.max(60, Math.min(86_400, c));
  }

  await user.save();
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
  if (input.alertCpuPercent !== undefined) {
    agent.alertCpuPercent = Math.max(1, Math.min(100, Math.round(input.alertCpuPercent)));
  }
  if (input.alertRamEnabled !== undefined) agent.alertRamEnabled = input.alertRamEnabled;
  if (input.alertRamPercent !== undefined) {
    agent.alertRamPercent = Math.max(1, Math.min(100, Math.round(input.alertRamPercent)));
  }
  if (input.alertDiskEnabled !== undefined) agent.alertDiskEnabled = input.alertDiskEnabled;
  if (input.alertDiskPercent !== undefined) {
    agent.alertDiskPercent = Math.max(1, Math.min(100, Math.round(input.alertDiskPercent)));
  }
  if (input.alertTempEnabled !== undefined) agent.alertTempEnabled = input.alertTempEnabled;
  if (input.alertTempLimit !== undefined) {
    agent.alertTempLimit = Math.max(1, Math.min(150, Math.round(input.alertTempLimit)));
  }
  if (input.alertOfflineEnabled !== undefined) agent.alertOfflineEnabled = input.alertOfflineEnabled;

  await agent.save();
  return agent.toObject();
}

export async function getUserResolvedAlertSettings(userId: string) {
  await connectDB();
  const user = await User.findById(userId).lean();
  if (!user) {
    throw new Error('User not found');
  }
  const token = user.telegramBotToken ? sanitizeTelegramBotToken(user.telegramBotToken) : '';
  const chat = user.telegramChatId ? sanitizeTelegramChatId(user.telegramChatId) : '';
  return {
    telegramBotToken: token || undefined,
    telegramChatId: chat || undefined,
    telegramTopicId: user.telegramTopicId?.trim() || undefined,
    telegramCooldownSeconds: user.telegramCooldownSeconds ?? 300,
    
    // Global rule settings
    alertCpuPercent: user.alertCpuPercent ?? 85,
    alertCpuEnabled: user.alertCpuEnabled !== false,
    alertRamPercent: user.alertRamPercent ?? 85,
    alertRamEnabled: user.alertRamEnabled !== false,
    alertDiskPercent: user.alertDiskPercent ?? 90,
    alertDiskEnabled: user.alertDiskEnabled !== false,
    alertTempLimit: user.alertTempLimit ?? 80,
    alertTempEnabled: Boolean(user.alertTempEnabled),
    alertOfflineEnabled: user.alertOfflineEnabled !== false,
  };
}
