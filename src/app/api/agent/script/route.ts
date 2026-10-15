import { NextResponse } from 'next/server';
import { readAgentScript } from '@/lib/agent-script';
import { limitByIp } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The agent body (no secrets inside). Used by the installer and by self-update. */
export async function GET(req: Request) {
  const limited = limitByIp(req, 'agent-script', 60, 10 * 60_000);
  if (limited) return limited;
  try {
    const { script, version } = await readAgentScript();
    return new NextResponse(script, {
      headers: {
        'Content-Type': 'text/x-shellscript; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Agent-Version': version,
      },
    });
  } catch {
    return new NextResponse('agent script missing on server', { status: 500 });
  }
}
