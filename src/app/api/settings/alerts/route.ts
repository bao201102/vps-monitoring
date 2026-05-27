import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getUserAlertSettings,
  updateUserAlertSettings,
} from '@/lib/user-settings';
import { getSessionFromCookies } from '@/lib/auth';
import { Agent } from '@/lib/models/Agent';
import { connectDB } from '@/lib/db';
import { TelegramTokenRejectedError } from '@/lib/telegram-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const putSchema = z.object({
  telegramBotToken: z.string().max(512).optional(),
  clearTelegramBotToken: z.boolean().optional(),
  telegramChatId: z.string().max(64).optional(),
  telegramTopicId: z.string().max(64).optional(),
  alertCpuPercent: z.number().int().min(1).max(100).optional(),
  alertCpuEnabled: z.boolean().optional(),
  alertRamPercent: z.number().int().min(1).max(100).optional(),
  alertRamEnabled: z.boolean().optional(),
  alertDiskPercent: z.number().int().min(1).max(100).optional(),
  alertDiskEnabled: z.boolean().optional(),
  alertTempLimit: z.number().int().min(1).max(150).optional(),
  alertTempEnabled: z.boolean().optional(),
  alertOfflineEnabled: z.boolean().optional(),
  telegramCooldownSeconds: z.number().int().min(60).max(86_400).optional(),
});

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    await connectDB();
    const settings = await getUserAlertSettings(session.sub);
    const agents = await Agent.find({ userId: session.sub })
      .select('agentId hostname label alertsUseGlobal alertCpuEnabled alertCpuPercent alertRamEnabled alertRamPercent alertDiskEnabled alertDiskPercent alertTempEnabled alertTempLimit alertOfflineEnabled')
      .sort({ hostname: 1, agentId: 1 })
      .lean();
    return NextResponse.json({ ...settings, agents });
  } catch (e) {
    console.error('[settings/alerts GET]', e);
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const settings = await updateUserAlertSettings(session.sub, parsed.data);
    const agents = await Agent.find({ userId: session.sub })
      .select('agentId hostname label alertsUseGlobal alertCpuEnabled alertCpuPercent alertRamEnabled alertRamPercent alertDiskEnabled alertDiskPercent alertTempEnabled alertTempLimit alertOfflineEnabled')
      .sort({ hostname: 1, agentId: 1 })
      .lean();
    return NextResponse.json({ ...settings, agents });
  } catch (e) {
    if (e instanceof TelegramTokenRejectedError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error('[settings/alerts PUT]', e);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
