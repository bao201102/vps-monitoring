import { describe, expect, it } from 'vitest';
import {
  evaluateContainerConditions,
  evaluateHostConditions,
  evaluateServiceConditions,
  isContainerProblem,
  resolveAgentRules,
  type HostSnapshot,
} from '@/lib/alerts';
import type { ResolvedAlertSettings } from '@/lib/user-settings';

const settings: ResolvedAlertSettings = {
  alertCpuPercent: 85,
  alertCpuEnabled: true,
  alertRamPercent: 85,
  alertRamEnabled: true,
  alertDiskPercent: 90,
  alertDiskEnabled: true,
  alertTempLimit: 80,
  alertTempEnabled: true,
  alertOfflineEnabled: true,
  alertServiceEnabled: true,
  alertContainerEnabled: true,
  alertDomainEnabled: true,
  alertSslDays: 14,
  telegramCooldownSeconds: 300,
};

const GB = 1024 ** 3;
const base: HostSnapshot = {
  cpuPercent: 10,
  prevCpuPercent: 10,
  memUsedBytes: 1 * GB,
  memTotalBytes: 4 * GB,
  disks: [{ mount: '/', usedBytes: 10 * GB, totalBytes: 100 * GB }],
  temperatures: { cpu: 40 },
};

const rules = resolveAgentRules({}, settings);
const keys = (cs: { key: string }[]) => cs.map((c) => c.key).sort();

describe('resolveAgentRules', () => {
  it('uses global rules by default', () => {
    expect(resolveAgentRules({ alertCpuPercent: 10 }, settings).cpuLimit).toBe(85);
  });
  it('uses per-agent overrides when alertsUseGlobal is false', () => {
    const r = resolveAgentRules({ alertsUseGlobal: false, alertCpuPercent: 50, alertRamEnabled: false }, settings);
    expect(r.cpuLimit).toBe(50);
    expect(r.ramEnabled).toBe(false);
  });
});

describe('evaluateHostConditions', () => {
  it('returns nothing for a healthy host', () => {
    expect(evaluateHostConditions(rules, base, new Set())).toEqual([]);
  });

  it('needs two high CPU samples before opening', () => {
    expect(keys(evaluateHostConditions(rules, { ...base, cpuPercent: 95, prevCpuPercent: 20 }, new Set()))).toEqual([]);
    expect(keys(evaluateHostConditions(rules, { ...base, cpuPercent: 95, prevCpuPercent: 90 }, new Set()))).toEqual(['cpu']);
  });

  it('keeps an open incident until the value drops below limit - hysteresis', () => {
    const open = new Set(['cpu']);
    expect(keys(evaluateHostConditions(rules, { ...base, cpuPercent: 82 }, open))).toEqual(['cpu']);
    expect(keys(evaluateHostConditions(rules, { ...base, cpuPercent: 79 }, open))).toEqual([]);
  });

  it('checks every mount point separately', () => {
    const snap = {
      ...base,
      disks: [
        { mount: '/', usedBytes: 10 * GB, totalBytes: 100 * GB },
        { mount: '/data', usedBytes: 95 * GB, totalBytes: 100 * GB },
      ],
    };
    expect(keys(evaluateHostConditions(rules, snap, new Set()))).toEqual(['disk:/data']);
  });

  it('flags RAM and temperature over their limits', () => {
    const snap = { ...base, memUsedBytes: 3.9 * GB, temperatures: { cpu: 40, nvme: 91 } };
    const out = evaluateHostConditions(rules, snap, new Set());
    expect(keys(out)).toEqual(['ram', 'temp']);
    expect(out.find((c) => c.key === 'temp')?.detail).toContain('nvme');
  });

  it('respects disabled rules', () => {
    const r = resolveAgentRules({}, { ...settings, alertRamEnabled: false });
    expect(evaluateHostConditions(r, { ...base, memUsedBytes: 4 * GB }, new Set())).toEqual([]);
  });
});

describe('service and container conditions', () => {
  it('opens one incident per failed unit', () => {
    const out = evaluateServiceConditions(rules, [
      { name: 'nginx', state: 'Active', subState: 'Running' },
      { name: 'backup', state: 'Failed', subState: 'Failed', result: 'exit-code' },
    ]);
    expect(keys(out)).toEqual(['service:backup']);
  });

  it('classifies container states', () => {
    expect(isContainerProblem('Up 3 hours (healthy)', 'Healthy')).toBeNull();
    expect(isContainerProblem('Exited (0) 2 days ago', 'None')).toBeNull();
    expect(isContainerProblem('Exited (137) 5 minutes ago', 'None')).toContain('137');
    expect(isContainerProblem('Restarting (1) 3 seconds ago', 'None')).not.toBeNull();
    expect(isContainerProblem('Up 2 minutes (unhealthy)', 'Unhealthy')).not.toBeNull();
  });

  it('skips container alerts when disabled', () => {
    const r = resolveAgentRules({}, { ...settings, alertContainerEnabled: false });
    expect(evaluateContainerConditions(r, [{ name: 'x', status: 'Exited (1)', health: 'None' }])).toEqual([]);
  });
});
