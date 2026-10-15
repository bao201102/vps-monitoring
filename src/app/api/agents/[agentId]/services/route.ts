import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Agent } from '@/lib/models/Agent';
import { SystemService } from '@/lib/models/SystemService';
import { getSessionFromCookies } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: { agentId: string };
}

export async function GET(_req: Request, { params }: RouteContext) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();

  // Validate agent ownership
  const agent = await Agent.findOne({ agentId: params.agentId, userId: session.sub }).lean();
  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  const services = await SystemService.find({ agentId: params.agentId }).sort({ name: 1 }).lean();

  // Map to response shape (include extended fields)
  const result = services.map((s: any) => ({
    name: s.name,
    description: s.description,
    state: s.state,
    subState: s.subState,
    cpu10m: s.cpu10m,
    cpuPeak: s.cpuPeak,
    memory: s.memory,
    memoryPeak: s.memoryPeak ?? null,
    updated: s.updatedAt ? s.updatedAt.toISOString() : s.updated,
    // Extended metadata
    fragmentPath: s.fragmentPath ?? null,
    mainPid: s.mainPid ?? null,
    nRestarts: s.nRestarts ?? null,
    tasksCurrent: s.tasksCurrent ?? null,
    tasksMax: s.tasksMax ?? null,
    requires: s.requires ?? [],
    documentation: s.documentation ?? [],
    unitFileState: s.unitFileState ?? null,
    loadState: s.loadState ?? null,
    activeEnterTimestamp: s.activeEnterTimestamp ?? null,
    wants: s.wants ?? [],
    conflicts: s.conflicts ?? [],
    before: s.before ?? [],
    after: s.after ?? [],
    statusText: s.statusText ?? null,
    result: s.result ?? null,
    cpuUsageNSec: s.cpuUsageNSec ?? null,
    memoryLimit: s.memoryLimit ?? null,
    canStart: s.canStart ?? "Yes",
    canStop: s.canStop ?? "Yes",
    canReload: s.canReload ?? "No",
  }));

  return NextResponse.json({ services: result });
}
