import { readFile } from 'node:fs/promises';
import path from 'node:path';

let cached: { script: string; version: string } | null = null;

/** The agent body served to VPSes (install + self-update). */
export async function readAgentScript(): Promise<{ script: string; version: string }> {
  if (cached && process.env.NODE_ENV === 'production') return cached;
  const raw = await readFile(path.join(process.cwd(), 'agent', 'agent.sh'), 'utf8');
  const script = raw.replace(/\r\n/g, '\n');
  const version = script.match(/^AGENT_VERSION="([^"]+)"/m)?.[1] ?? '0.0.0';
  cached = { script, version };
  return cached;
}

export async function latestAgentVersion(): Promise<string> {
  try {
    return (await readAgentScript()).version;
  } catch {
    return '0.0.0';
  }
}

/** Numeric dotted-version compare; missing parts count as 0. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((x) => parseInt(x, 10) || 0);
  const pb = b.split('.').map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}
