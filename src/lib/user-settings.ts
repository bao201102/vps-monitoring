import { connectDB } from '@/lib/db';
import { User } from '@/lib/models/User';
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
  alertRamPercent: number;
  alertDiskPercent: number;
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
    alertRamPercent: user.alertRamPercent ?? 85,
    alertDiskPercent: user.alertDiskPercent ?? 90,
    telegramCooldownSeconds: user.telegramCooldownSeconds ?? 300,
  };
}

export type UpdateUserAppSettingsInput = {
  telegramBotToken?: string;
  clearTelegramBotToken?: boolean;
  telegramChatId?: string;
  telegramTopicId?: string;
  alertCpuPercent?: number;
  alertRamPercent?: number;
  alertDiskPercent?: number;
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
  if (input.alertRamPercent !== undefined) {
    user.alertRamPercent = Math.max(1, Math.min(100, Math.round(input.alertRamPercent)));
  }
  if (input.alertDiskPercent !== undefined) {
    user.alertDiskPercent = Math.max(1, Math.min(100, Math.round(input.alertDiskPercent)));
  }
  if (input.telegramCooldownSeconds !== undefined) {
    const c = Math.round(input.telegramCooldownSeconds);
    user.telegramCooldownSeconds = Math.max(60, Math.min(86_400, c));
  }

  await user.save();
  return {
    botTokenConfigured: Boolean(user.telegramBotToken),
    telegramChatId: user.telegramChatId ?? '',
    telegramTopicId: user.telegramTopicId ?? '',
    alertCpuPercent: user.alertCpuPercent,
    alertRamPercent: user.alertRamPercent,
    alertDiskPercent: user.alertDiskPercent,
    telegramCooldownSeconds: user.telegramCooldownSeconds,
  };
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
    alertCpuPercent: user.alertCpuPercent ?? 85,
    alertRamPercent: user.alertRamPercent ?? 85,
    alertDiskPercent: user.alertDiskPercent ?? 90,
    telegramCooldownSeconds: user.telegramCooldownSeconds ?? 300,
  };
}
