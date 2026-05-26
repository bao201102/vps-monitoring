'use client';

import useSWR from 'swr';
import { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  KeyRound,
  Loader2,
  Monitor,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { ThemeToggle } from '@/components/ThemeToggle';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type AlertSettingsResponse = {
  botTokenConfigured: boolean;
  telegramChatId: string;
  telegramTopicId: string;
  alertCpuPercent: number;
  alertRamPercent: number;
  alertDiskPercent: number;
  telegramCooldownSeconds: number;
};

export function SettingsClient({
  appUrl,
  offlineAfterSeconds,
}: {
  appUrl: string;
  offlineAfterSeconds: number;
}) {
  const { data } = useSWR<{ user: { username: string; role?: string } | null }>('/api/auth/me', fetcher);
  const {
    data: alertData,
    error: alertError,
    isLoading: alertLoading,
    mutate: mutateAlerts,
  } = useSWR<AlertSettingsResponse>('/api/settings/alerts', fetcher);

  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const [chatId, setChatId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [botToken, setBotToken] = useState('');
  const [clearBotToken, setClearBotToken] = useState(false);
  const [cpu, setCpu] = useState('85');
  const [ram, setRam] = useState('85');
  const [disk, setDisk] = useState('90');
  const [cooldown, setCooldown] = useState('300');
  const [alertsHydrated, setAlertsHydrated] = useState(false);
  const [savingAlerts, setSavingAlerts] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!alertData || alertsHydrated) return;
    setChatId(alertData.telegramChatId);
    setTopicId(alertData.telegramTopicId || '');
    setCpu(String(alertData.alertCpuPercent));
    setRam(String(alertData.alertRamPercent));
    setDisk(String(alertData.alertDiskPercent));
    setCooldown(String(alertData.telegramCooldownSeconds));
    setAlertsHydrated(true);
  }, [alertData, alertsHydrated]);

  const copy = async () => {
    await navigator.clipboard.writeText(appUrl);
    setCopied(true);
    toast.success('Copied');
    setTimeout(() => setCopied(false), 1500);
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPwd.length < 8) return toast.error('New password must be at least 8 chars.');
    if (newPwd !== confirmPwd) return toast.error('Passwords do not match.');
    setSaving(true);
    const res = await fetch('/api/auth/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPassword: oldPwd, newPassword: newPwd }),
    });
    const out = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return toast.error(out.error ?? 'Failed');
    toast.success('Password updated');
    setOldPwd('');
    setNewPwd('');
    setConfirmPwd('');
  };

  const saveAlerts = async (e: React.FormEvent) => {
    e.preventDefault();
    const nCpu = Math.round(Number(cpu));
    const nRam = Math.round(Number(ram));
    const nDisk = Math.round(Number(disk));
    const nCd = Math.round(Number(cooldown));
    if (!Number.isFinite(nCpu) || nCpu < 1 || nCpu > 100) {
      return toast.error('CPU: enter a value between 1 and 100.');
    }
    if (!Number.isFinite(nRam) || nRam < 1 || nRam > 100) {
      return toast.error('RAM: enter a value between 1 and 100.');
    }
    if (!Number.isFinite(nDisk) || nDisk < 1 || nDisk > 100) {
      return toast.error('Disk: enter a value between 1 and 100.');
    }
    if (!Number.isFinite(nCd) || nCd < 60 || nCd > 86_400) {
      return toast.error('Cooldown: must be between 60 and 86400 seconds.');
    }

    const body: Record<string, unknown> = {
      telegramChatId: chatId,
      telegramTopicId: topicId,
      alertCpuPercent: nCpu,
      alertRamPercent: nRam,
      alertDiskPercent: nDisk,
      telegramCooldownSeconds: nCd,
    };
    const trimmed = botToken.trim();
    if (trimmed) body.telegramBotToken = trimmed;
    if (clearBotToken) body.clearTelegramBotToken = true;

    setSavingAlerts(true);
    const res = await fetch('/api/settings/alerts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const out = await res.json().catch(() => ({}));
    setSavingAlerts(false);
    if (!res.ok) {
      return toast.error(out.error ?? 'Failed to save settings');
    }
    mutateAlerts(out, false);
    setChatId(out.telegramChatId);
    setTopicId(out.telegramTopicId || '');
    setCpu(String(out.alertCpuPercent));
    setRam(String(out.alertRamPercent));
    setDisk(String(out.alertDiskPercent));
    setCooldown(String(out.telegramCooldownSeconds));
    setBotToken('');
    setClearBotToken(false);
    toast.success('Telegram alert settings saved');
  };

  const sendTest = async () => {
    setTesting(true);
    const res = await fetch('/api/settings/alerts/test', { method: 'POST' });
    const out = await res.json().catch(() => ({}));
    setTesting(false);
    if (!res.ok) return toast.error(out.error ?? 'Test message failed');
    toast.success('Test message sent — check your Telegram');
  };

  const configured =
    alertData?.botTokenConfigured && (alertData.telegramChatId?.trim() ?? '').length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-ink-muted">Manage your admin account and dashboard.</p>
      </div>

      <div className="card card-pad">
        <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
          <Monitor className="h-4 w-4 text-ink-muted" />
          Appearance
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Light or dark interface. Your choice is saved in this browser.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-sm text-ink-soft">Theme</span>
          <ThemeToggle className="border border-border bg-bg-muted" />
        </div>
      </div>

      <div className="card card-pad">
        <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
          <ShieldCheck className="h-4 w-4 text-success" />
          Account
        </h2>
        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
          <Row label="Username" value={data?.user?.username ?? '—'} />
          <Row label="Role" value={data?.user?.role === 'admin' ? 'Administrator' : 'User'} />
          <Row label="Public sign-ups" value={<span className="chip-success">Enabled</span>} />
        </dl>
      </div>

      <form onSubmit={changePassword} className="card card-pad">
        <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
          <KeyRound className="h-4 w-4 text-ink-muted" />
          Change password
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="label">Current password</label>
            <input
              type="password"
              className="input"
              value={oldPwd}
              onChange={(e) => setOldPwd(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="label">New password</label>
            <input
              type="password"
              className="input"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              minLength={8}
              required
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="label">Confirm new password</label>
            <input
              type="password"
              className="input"
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              minLength={8}
              required
              autoComplete="new-password"
            />
          </div>
        </div>
        <div className="mt-4">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Update password
          </button>
        </div>
      </form>

      <form onSubmit={saveAlerts} className="card card-pad">
        <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
          <Send className="h-4 w-4 text-ink-muted" />
          Telegram Alerts
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          When CPU, RAM, or disk (/) exceeds a threshold, the VPS heartbeat times out, or the agent
          sends a shutdown/service-stop signal, the dashboard sends a Telegram message. Settings are
          stored in MongoDB.
        </p>

        {alertLoading && (
          <div className="mt-4 flex items-center gap-2 text-sm text-ink-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading settings…
          </div>
        )}
        {alertError && (
          <p className="mt-4 text-sm text-danger">Failed to load settings (try re-logging or check the API).</p>
        )}

        {!alertLoading && alertData && (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-ink-soft">Status:</span>
              {configured ? (
                <span className="chip-success">Enabled (bot + chat id configured)</span>
              ) : (
                <span className="chip-muted">Bot token or chat ID missing</span>
              )}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="label">Bot token (@BotFather)</label>
                <input
                  type="password"
                  className="input font-mono text-sm"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder={alertData.botTokenConfigured ? '•••• keep current token — enter new to replace' : '123456789:ABC...'}
                  autoComplete="off"
                />
                {alertData.botTokenConfigured && (
                  <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm text-ink-muted">
                    <input
                      type="checkbox"
                      checked={clearBotToken}
                      onChange={(e) => setClearBotToken(e.target.checked)}
                    />
                    Clear saved token (applies after saving)
                  </label>
                )}
              </div>
              <div>
                <label className="label">Chat ID (user or group)</label>
                <input
                  className="input font-mono text-sm"
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  placeholder="-100… or numeric user id"
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="label">Topic ID (Message Thread ID — optional)</label>
                <input
                  className="input font-mono text-sm"
                  value={topicId}
                  onChange={(e) => setTopicId(e.target.value)}
                  placeholder="Enter topic id (e.g. 12)"
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="label">Alert when CPU ≥ (%)</label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={100}
                  value={cpu}
                  onChange={(e) => setCpu(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Alert when RAM ≥ (%)</label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={100}
                  value={ram}
                  onChange={(e) => setRam(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Alert when disk / ≥ (%)</label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={100}
                  value={disk}
                  onChange={(e) => setDisk(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Cooldown (seconds / per server)</label>
                <input
                  className="input"
                  type="number"
                  min={60}
                  max={86400}
                  value={cooldown}
                  onChange={(e) => setCooldown(e.target.value)}
                />
                <p className="mt-1 text-[11px] text-ink-soft">Minimum 60, maximum 86400.</p>
              </div>
            </div>

            <p className="mt-4 text-xs text-ink-soft">
              The bot token is stored in the same database as the dashboard — only suitable when
              you control both MongoDB and the application server.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <button type="submit" className="btn-primary" disabled={savingAlerts}>
                {savingAlerts && <Loader2 className="h-4 w-4 animate-spin" />}
                Save settings
              </button>
              <button
                type="button"
                className="btn-secondary inline-flex items-center gap-2"
                disabled={testing || !configured}
                onClick={sendTest}
                title={!configured ? 'Bot token + chat ID required' : undefined}
              >
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send test
              </button>
            </div>
          </>
        )}
      </form>

      <div className="card card-pad">
        <h2 className="text-base font-semibold text-ink">Dashboard</h2>
        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[11px] uppercase tracking-wider text-ink-soft">App URL</dt>
            <dd className="mt-1 flex items-center gap-2">
              <code className="truncate font-mono text-ink">{appUrl}</code>
              <button
                type="button"
                onClick={copy}
                className="rounded-md p-1.5 text-ink-soft hover:bg-bg-muted hover:text-ink"
              >
                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              </button>
            </dd>
            <p className="mt-1 text-[11px] text-ink-soft">
              Set via <code>NEXT_PUBLIC_APP_URL</code> in your environment.
            </p>
          </div>
          <Row
            label="Offline threshold"
            value={`${offlineAfterSeconds}s without heartbeat`}
          />
        </dl>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] uppercase tracking-wider text-ink-soft">{label}</dt>
      <dd className="truncate text-ink">{value}</dd>
    </div>
  );
}
