import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Agent } from '@/lib/models/Agent';
import { VpsPort } from '@/lib/models/VpsPort';
import { VpsDomain } from '@/lib/models/VpsDomain';
import { DomainCheck } from '@/lib/models/DomainCheck';
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

  const agent = await Agent.exists({ agentId: params.agentId, userId: session.sub });
  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  const [ports, domains, checks] = await Promise.all([
    VpsPort.find({ agentId: params.agentId }).sort({ port: 1 }).lean(),
    VpsDomain.find({ agentId: params.agentId }).sort({ domain: 1 }).lean(),
    DomainCheck.find({ agentId: params.agentId }).lean(),
  ]);
  const checkByDomain = new Map(checks.map((c) => [c.domain, c]));

  return NextResponse.json({
    ports,
    domains: domains.map((d) => {
      const c = checkByDomain.get(d.domain.toLowerCase());
      return {
        ...d,
        check: c
          ? {
              ok: c.ok,
              httpStatus: c.httpStatus,
              responseMs: c.responseMs,
              error: c.error,
              sslValidTo: c.sslValidTo,
              sslIssuer: c.sslIssuer,
              checkedAt: c.checkedAt,
            }
          : null,
      };
    }),
  });
}
