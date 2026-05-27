import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionFromCookies } from '@/lib/auth';
import { updateAgentAlertSettings } from '@/lib/user-settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const agentAlertSchema = z.object({
  alertsUseGlobal: z.boolean(),
  alertCpuEnabled: z.boolean().optional(),
  alertCpuPercent: z.number().int().min(1).max(100).optional(),
  alertRamEnabled: z.boolean().optional(),
  alertRamPercent: z.number().int().min(1).max(100).optional(),
  alertDiskEnabled: z.boolean().optional(),
  alertDiskPercent: z.number().int().min(1).max(100).optional(),
  alertTempEnabled: z.boolean().optional(),
  alertTempLimit: z.number().int().min(1).max(150).optional(),
  alertOfflineEnabled: z.boolean().optional(),
});

interface RouteContext {
  params: { agentId: string };
}

export async function PUT(req: Request, { params }: RouteContext) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = agentAlertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const agent = await updateAgentAlertSettings(session.sub, params.agentId, parsed.data);
    return NextResponse.json({ ok: true, agent });
  } catch (e: any) {
    console.error('[agent alerts PUT]', e);
    return NextResponse.json({ error: e.message || 'Failed to save agent settings' }, { status: 500 });
  }
}
