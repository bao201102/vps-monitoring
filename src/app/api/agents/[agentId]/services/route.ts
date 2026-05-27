import { NextResponse } from 'next/server';
import { z } from 'zod';
import { connectDB } from '@/lib/db';
import { Agent } from '@/lib/models/Agent';
import { AgentCommand } from '@/lib/models/AgentCommand';
import { SystemService } from '@/lib/models/SystemService';
import { getSessionFromCookies } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: { agentId: string };
}

const serviceSchema = z.object({
  serviceName: z.string().min(1),
  action: z.enum(['start', 'stop', 'restart']),
});

const MOCK_SERVICES: Record<string, any[]> = {
  'instance-20260414-1357': [
    { name: 'apparmor', description: 'AppArmor initialization', state: 'Active', subState: 'Exited', cpu10m: null, cpuPeak: null, memory: null, memoryPeak: null, updated: '8:24:20 PM' },
    { name: 'apport', description: 'Automatic Crash Reports Generation', state: 'Active', subState: 'Exited', cpu10m: null, cpuPeak: null, memory: null, memoryPeak: null, updated: '8:24:20 PM' },
    { name: 'beszel-agent', description: 'Beszel Agent Service', state: 'Active', subState: 'Running', cpu10m: 0.01, cpuPeak: 0.10, memory: 8.63 * 1024 * 1024, memoryPeak: 10.0 * 1024 * 1024, updated: '8:24:20 PM' },
    { name: 'cloud-config', description: 'Apply the settings in cloud-config', state: 'Active', subState: 'Exited', cpu10m: null, cpuPeak: null, memory: null, memoryPeak: null, updated: '8:24:20 PM' },
    { name: 'docker.service', description: 'Docker Application Container Engine', state: 'Active', subState: 'Running', cpu10m: 0.25, cpuPeak: 1.45, memory: 92.4 * 1024 * 1024, memoryPeak: 112.5 * 1024 * 1024, updated: '8:24:20 PM' },
    { name: 'nginx.service', description: 'Nginx Reverse Proxy Server', state: 'Active', subState: 'Running', cpu10m: 0.05, cpuPeak: 0.42, memory: 24.5 * 1024 * 1024, memoryPeak: 32.0 * 1024 * 1024, updated: '8:24:20 PM' },
    { name: 'ssh.service', description: 'OpenSSH Daemon', state: 'Active', subState: 'Running', cpu10m: 0.00, cpuPeak: 0.02, memory: 4.82 * 1024 * 1024, memoryPeak: 6.2 * 1024 * 1024, updated: '8:24:20 PM' },
    { name: 'fail2ban.service', description: 'Brute-force authentication banner daemon', state: 'Failed', subState: 'Failed', cpu10m: null, cpuPeak: null, memory: null, memoryPeak: null, updated: '8:24:20 PM' },
  ],
  'monitoring': [
    { name: 'apparmor', description: 'AppArmor initialization', state: 'Active', subState: 'Exited', cpu10m: null, cpuPeak: null, memory: null, memoryPeak: null, updated: '8:24:20 PM' },
    { name: 'mongodb.service', description: 'MongoDB Database Server', state: 'Active', subState: 'Running', cpu10m: 0.65, cpuPeak: 2.10, memory: 184.2 * 1024 * 1024, memoryPeak: 210.0 * 1024 * 1024, updated: '8:24:20 PM' },
    { name: 'vps-monitoring.service', description: 'VPS Monitoring Web Application', state: 'Active', subState: 'Running', cpu10m: 0.08, cpuPeak: 0.35, memory: 78.4 * 1024 * 1024, memoryPeak: 95.0 * 1024 * 1024, updated: '8:24:20 PM' },
    { name: 'docker.service', description: 'Docker Application Container Engine', state: 'Active', subState: 'Running', cpu10m: 0.18, cpuPeak: 0.95, memory: 84.1 * 1024 * 1024, memoryPeak: 102.0 * 1024 * 1024, updated: '8:24:20 PM' },
    { name: 'ssh.service', description: 'OpenSSH Daemon', state: 'Active', subState: 'Running', cpu10m: 0.00, cpuPeak: 0.01, memory: 5.2 * 1024 * 1024, memoryPeak: 6.5 * 1024 * 1024, updated: '8:24:20 PM' },
    { name: 'cron.service', description: 'Regular Background Program Daemon', state: 'Active', subState: 'Running', cpu10m: 0.00, cpuPeak: 0.01, memory: 2.1 * 1024 * 1024, memoryPeak: 2.5 * 1024 * 1024, updated: '8:24:20 PM' },
    { name: 'fail2ban.service', description: 'Brute-force authentication banner daemon', state: 'Active', subState: 'Running', cpu10m: 0.01, cpuPeak: 0.08, memory: 24.1 * 1024 * 1024, memoryPeak: 30.0 * 1024 * 1024, updated: '8:24:20 PM' },
  ]
};

const DEFAULT_MOCK: any[] = [
  { name: 'apparmor', description: 'AppArmor initialization', state: 'Active', subState: 'Exited', cpu10m: null, cpuPeak: null, memory: null, memoryPeak: null, updated: '8:24:20 PM' },
  { name: 'ssh.service', description: 'OpenSSH Daemon', state: 'Active', subState: 'Running', cpu10m: 0.00, cpuPeak: 0.02, memory: 4.5 * 1024 * 1024, memoryPeak: 5.8 * 1024 * 1024, updated: '8:24:20 PM' },
  { name: 'docker.service', description: 'Docker Application Container Engine', state: 'Active', subState: 'Running', cpu10m: 0.15, cpuPeak: 0.85, memory: 76.2 * 1024 * 1024, memoryPeak: 90.0 * 1024 * 1024, updated: '8:24:20 PM' },
];

export async function GET(_req: Request, { params }: RouteContext) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();

  // Validate agent ownership
  const agent = await Agent.findOne({ agentId: params.agentId, userId: session.sub }).lean();
  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  // Find system services stored in MongoDB
  let services = await SystemService.find({ agentId: params.agentId }).lean();

  // Fallback to static mock data if empty
  if (services.length === 0) {
    const list = MOCK_SERVICES[params.agentId] || DEFAULT_MOCK;
    services = list.map(item => ({
      ...item,
      agentId: params.agentId,
    })) as any;
  }

  // Map to response shape (include extended fields)
  const result = services.map((s: any) => ({
    name: s.name,
    description: s.description,
    state: s.state,
    subState: s.subState,
    cpu10m: s.cpu10m,
    cpuPeak: s.cpuPeak,
    memory: s.memory,
    memoryPeak: s.memoryPeak,
    updated: s.updatedAt ? s.updatedAt.toISOString() : (s.updated || new Date().toISOString()),
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
  }));

  return NextResponse.json({ services: result });
}

export async function POST(req: Request, { params }: RouteContext) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = serviceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  await connectDB();

  // Validate agent ownership
  const agent = await Agent.findOne({ agentId: params.agentId, userId: session.sub }).lean();
  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  // Create pending command in database
  const command = await AgentCommand.create({
    agentId: params.agentId,
    action: parsed.data.action,
    service: parsed.data.serviceName,
    status: 'pending',
  });

  // Long poll for agent execution (up to 3 seconds)
  const maxAttempts = 10;
  const delayMs = 300;

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    const checkCmd = await AgentCommand.findById(command._id).lean();
    if (checkCmd) {
      if (checkCmd.status === 'done') {
        return NextResponse.json({ ok: true, status: 'done', commandId: command._id });
      }
      if (checkCmd.status === 'failed') {
        return NextResponse.json({ ok: true, status: 'failed', error: 'Command execution failed on VPS', commandId: command._id });
      }
    }
  }

  // Return pending state if command execution is taking longer
  return NextResponse.json({ ok: true, status: 'pending', commandId: command._id });
}
