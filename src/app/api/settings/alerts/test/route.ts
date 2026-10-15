import { NextResponse } from 'next/server';
import { getUserResolvedAlertSettings } from '@/lib/user-settings';
import { getSessionFromCookies } from '@/lib/auth';
import { hasNotificationChannel, notify } from '@/lib/notify';
import { limitByIp } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const limited = limitByIp(req, 'alert-test', 10, 60_000);
  if (limited) return limited;

  try {
    const settings = await getUserResolvedAlertSettings(session.sub);
    if (!hasNotificationChannel(settings)) {
      return NextResponse.json(
        { error: 'Chưa cấu hình kênh nào (Telegram bot token + chat id, hoặc webhook). Lưu cấu hình trước khi gửi thử.' },
        { status: 400 }
      );
    }
    const results = await notify(settings, {
      phase: 'test',
      severity: 'info',
      title: 'VPS Monitor — tin nhắn thử',
      lines: ['Nếu bạn thấy tin này, kênh thông báo đã cấu hình đúng.'],
    });
    const failed = results.filter((r) => !r.ok);
    if (failed.length) {
      return NextResponse.json(
        { error: failed.map((f) => `${f.channel}: ${f.error}`).join('; '), results },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true, results });
  } catch (e) {
    console.error('[settings/alerts/test]', e);
    return NextResponse.json({ error: 'Gửi thử thất bại' }, { status: 500 });
  }
}
