import { NextResponse } from 'next/server';
import { getUserResolvedAlertSettings } from '@/lib/user-settings';
import { getSessionFromCookies } from '@/lib/auth';
import { isTelegramAlertsConfigured, sendTelegramSettingsTestResult } from '@/lib/telegram-alerts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const settings = await getUserResolvedAlertSettings(session.sub);
    if (!isTelegramAlertsConfigured(settings)) {
      return NextResponse.json(
        { error: 'Chưa có bot token và chat id. Lưu cấu hình trước khi gửi thử.' },
        { status: 400 }
      );
    }
    const r = await sendTelegramSettingsTestResult(settings);
    if (!r.ok) {
      return NextResponse.json({ error: r.description, httpStatus: r.httpStatus }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[settings/alerts/test]', e);
    return NextResponse.json({ error: 'Gửi thử thất bại' }, { status: 500 });
  }
}
