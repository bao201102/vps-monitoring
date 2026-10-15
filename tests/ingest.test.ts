import { describe, expect, it } from 'vitest';
import { heartbeatSchema, serviceCpuPercent } from '@/lib/ingest';
import { compareVersions, readAgentScript } from '@/lib/agent-script';

describe('serviceCpuPercent', () => {
  const t0 = new Date('2026-01-01T00:00:00Z');
  const t1 = new Date('2026-01-01T00:00:10Z');
  it('computes machine-wide CPU from cumulative nanoseconds', () => {
    // 5 CPU-seconds over 10 s on 2 cores = 25 %
    expect(serviceCpuPercent(0, t0, 5e9, t1, 2)).toBe(25);
  });
  it('returns null without a previous sample or on counter reset', () => {
    expect(serviceCpuPercent(null, t0, 5e9, t1, 2)).toBeNull();
    expect(serviceCpuPercent(9e9, t0, 1e9, t1, 2)).toBeNull();
  });
  it('clamps to 100', () => {
    expect(serviceCpuPercent(0, t0, 100e9, t1, 1)).toBe(100);
  });
});

describe('heartbeatSchema', () => {
  it('accepts a minimal pre-2.0 payload', () => {
    const r = heartbeatSchema.safeParse({ agentId: 'vps_x', token: 'tok_y', cpuPercent: 12.5 });
    expect(r.success).toBe(true);
  });

  it('accepts a 2.0 payload with disks, containers without logs and temperatures', () => {
    const r = heartbeatSchema.safeParse({
      agentId: 'vps_x',
      token: 'tok_y',
      agentVersion: '2.0.0',
      remoteCommands: true,
      disks: [{ mount: '/', device: '/dev/sda1', fsType: 'ext4', usedBytes: 1, totalBytes: 2 }],
      containers: [{ id: 'abc', name: 'web', image: 'nginx', status: 'Up 1 hour' }],
      temperatures: { 'coretemp Package id 0': 55.5 },
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.containers?.[0].logs).toBeUndefined();
  });

  it('rejects out-of-range values', () => {
    expect(heartbeatSchema.safeParse({ agentId: 'a', token: 'b', cpuPercent: 250 }).success).toBe(false);
    expect(
      heartbeatSchema.safeParse({ agentId: 'a', token: 'b', ports: [{ proto: 'tcp', ip: '0.0.0.0', port: 70000 }] }).success
    ).toBe(false);
  });
});

describe('agent script', () => {
  it('compares versions numerically', () => {
    expect(compareVersions('1.9.0', '2.0.0')).toBe(-1);
    expect(compareVersions('2.0.10', '2.0.9')).toBe(1);
    expect(compareVersions('2.0', '2.0.0')).toBe(0);
  });

  it('ships an agent with a parseable version and no CRLF', async () => {
    const { script, version } = await readAgentScript();
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(script.includes('\r')).toBe(false);
    expect(script).toContain('ALLOW_REMOTE_COMMANDS');
  });
});
