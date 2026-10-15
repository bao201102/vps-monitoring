import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '@/lib/env';
import { findUserByEnrollToken } from '@/lib/enroll';
import { limitByIp } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function text(body: string, status: number) {
  // Served script is piped into `sudo bash`, so errors must be a harmless shell line.
  return new NextResponse(`echo ${JSON.stringify(body)} >&2; exit 1\n`, {
    status,
    headers: { 'Content-Type': 'text/x-shellscript; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export async function GET(req: Request) {
  const limited = limitByIp(req, 'install', 30, 10 * 60_000);
  if (limited) return limited;

  const url = new URL(req.url);
  const token = url.searchParams.get('token') ?? '';
  const interval = Math.min(300, Math.max(5, Math.round(Number(url.searchParams.get('interval')) || 15)));
  const allowCommands = url.searchParams.get('commands') === '1' ? '1' : '0';

  const user = await findUserByEnrollToken(token);
  if (!user) {
    return text('Invalid or expired enrollment token. Copy a fresh install command from the dashboard.', 401);
  }

  const scriptPath = path.join(process.cwd(), 'agent', 'install.sh');
  let template: string;
  try {
    // Normalise line endings in case the checkout used CRLF (bash chokes on \r).
    template = (await readFile(scriptPath, 'utf8')).replace(/\r\n/g, '\n');
  } catch {
    return text('install.sh template missing on server', 500);
  }

  // All substituted values are validated to a safe charset, so they cannot break
  // out of the double-quoted shell assignments in the template.
  const baseUrl = env.APP_URL.replace(/\/$/, '');
  if (!/^https?:\/\/[A-Za-z0-9.:\-\[\]/_]+$/.test(baseUrl)) {
    return text('NEXT_PUBLIC_APP_URL is not a valid URL', 500);
  }
  const userId = String(user._id);

  const rendered = template
    .replace(/__SERVER_URL__/g, baseUrl)
    .replace(/__INTERVAL__/g, String(interval))
    .replace(/__USER_ID__/g, userId)
    .replace(/__ENROLL_TOKEN__/g, token)
    .replace(/__ALLOW_COMMANDS__/g, allowCommands);

  return new NextResponse(rendered, {
    headers: {
      'Content-Type': 'text/x-shellscript; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
