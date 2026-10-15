import { describe, expect, it, beforeEach } from 'vitest';
import { isPrivateAddress, parseWebhookUrl } from '@/lib/net-guard';
import { rateLimit, __resetRateLimits } from '@/lib/rate-limit';
import { isObjectId } from '@/lib/http';
import { isEnrollTokenShape } from '@/lib/enroll';
import { COMMAND_ACTIONS, COMMAND_TARGET_RE } from '@/lib/models/AgentCommand';

describe('isPrivateAddress', () => {
  it.each(['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1'])(
    '%s is private',
    (ip) => expect(isPrivateAddress(ip)).toBe(true)
  );
  it.each(['8.8.8.8', '1.1.1.1', '172.32.0.1', '2606:4700:4700::1111'])('%s is public', (ip) =>
    expect(isPrivateAddress(ip)).toBe(false)
  );
});

describe('parseWebhookUrl', () => {
  it('accepts http(s) URLs', () => {
    expect(parseWebhookUrl('https://hooks.slack.com/services/x')).not.toBeNull();
  });
  it('rejects other schemes and embedded credentials', () => {
    expect(parseWebhookUrl('file:///etc/passwd')).toBeNull();
    expect(parseWebhookUrl('https://user:pw@example.com/')).toBeNull();
    expect(parseWebhookUrl('not a url')).toBeNull();
  });
});

describe('rateLimit', () => {
  beforeEach(() => __resetRateLimits());
  it('blocks after the limit within the window and resets after it', () => {
    const t = 1_000_000;
    expect(rateLimit('k', 2, 1000, t).ok).toBe(true);
    expect(rateLimit('k', 2, 1000, t + 1).ok).toBe(true);
    const blocked = rateLimit('k', 2, 1000, t + 2);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(rateLimit('k', 2, 1000, t + 1001).ok).toBe(true);
  });
});

describe('input shapes', () => {
  it('validates ObjectIds', () => {
    expect(isObjectId('65f0c0ffee0000000000abcd')).toBe(true);
    expect(isObjectId('x";rm -rf /;"')).toBe(false);
  });
  it('validates enrollment tokens', () => {
    expect(isEnrollTokenShape('enr_' + 'a'.repeat(32))).toBe(true);
    expect(isEnrollTokenShape('65f0c0ffee0000000000abcd')).toBe(false);
    expect(isEnrollTokenShape('enr_$(id)' + 'a'.repeat(32))).toBe(false);
  });
  it('only allows safe command targets and known actions', () => {
    expect(COMMAND_TARGET_RE.test('nginx')).toBe(true);
    expect(COMMAND_TARGET_RE.test('getty@tty1')).toBe(true);
    expect(COMMAND_TARGET_RE.test('nginx; reboot')).toBe(false);
    expect(COMMAND_TARGET_RE.test('--help')).toBe(true); // passed after `--` by the agent
    expect(COMMAND_ACTIONS.service).toEqual(['start', 'stop', 'restart']);
    expect(COMMAND_ACTIONS.agent).toEqual(['update']);
  });
});
