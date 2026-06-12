import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Agent } from '@/lib/models/Agent';
import { VpsPort } from '@/lib/models/VpsPort';
import { VpsDomain } from '@/lib/models/VpsDomain';
import { getSessionFromCookies } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: { agentId: string };
}

const MOCK_PORTS: Record<string, any[]> = {
  'instance-20260414-1357': [
    { proto: 'tcp', ip: '0.0.0.0', port: 80, service: 'nginx', pid: 1027 },
    { proto: 'tcp', ip: '0.0.0.0', port: 443, service: 'nginx', pid: 1027 },
    { proto: 'tcp', ip: '0.0.0.0', port: 22, service: 'sshd', pid: 654 },
    { proto: 'tcp', ip: '127.0.0.1', port: 27017, service: 'mongod', pid: 822 },
    { proto: 'tcp', ip: '0.0.0.0', port: 8080, service: 'node', pid: 1452 },
  ],
  'monitoring': [
    { proto: 'tcp', ip: '0.0.0.0', port: 80, service: 'nginx', pid: 902 },
    { proto: 'tcp', ip: '0.0.0.0', port: 443, service: 'nginx', pid: 902 },
    { proto: 'tcp', ip: '0.0.0.0', port: 22, service: 'sshd', pid: 412 },
    { proto: 'tcp', ip: '127.0.0.1', port: 27017, service: 'mongod', pid: 711 },
    { proto: 'tcp', ip: '0.0.0.0', port: 3000, service: 'node', pid: 1105 },
  ],
};

const DEFAULT_MOCK_PORTS = [
  { proto: 'tcp', ip: '0.0.0.0', port: 80, service: 'nginx', pid: 120 },
  { proto: 'tcp', ip: '0.0.0.0', port: 22, service: 'sshd', pid: 121 },
];

const MOCK_DOMAINS: Record<string, any[]> = {
  'instance-20260414-1357': [
    { domain: 'api.myproduct.com', type: 'nginx' },
    { domain: 'myproduct.com', type: 'nginx' },
    { domain: 'admin.myproduct.com', type: 'nginx' },
  ],
  'monitoring': [
    { domain: 'monitor.company.local', type: 'nginx' },
    { domain: 'status.company.com', type: 'nginx' },
  ],
};

const DEFAULT_MOCK_DOMAINS = [
  { domain: 'mywebsite.com', type: 'nginx' },
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

  let ports = await VpsPort.find({ agentId: params.agentId }).sort({ port: 1 }).lean();
  let domains = await VpsDomain.find({ agentId: params.agentId }).sort({ domain: 1 }).lean();

  // Fallback to static mock data if empty
  if (ports.length === 0) {
    ports = (MOCK_PORTS[params.agentId] || DEFAULT_MOCK_PORTS).map(p => ({
      ...p,
      agentId: params.agentId,
    })) as any;
  }
  if (domains.length === 0) {
    domains = (MOCK_DOMAINS[params.agentId] || DEFAULT_MOCK_DOMAINS).map(d => ({
      ...d,
      agentId: params.agentId,
    })) as any;
  }

  return NextResponse.json({ ports, domains });
}
