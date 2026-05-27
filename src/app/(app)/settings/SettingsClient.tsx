'use client';

import useSWR from 'swr';
import React, { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  KeyRound,
  Loader2,
  Monitor,
  Send,
  ShieldCheck,
  Sliders,
  Server,
  Bell,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { ThemeToggle } from '@/components/ThemeToggle';
import { cn } from '@/lib/utils';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type AgentAlertConfig = {
  agentId: string;
  hostname: string;
  label?: string;
  alertsUseGlobal: boolean;
  alertCpuEnabled: boolean;
  alertCpuPercent: number;
  alertRamEnabled: boolean;
  alertRamPercent: number;
  alertDiskEnabled: boolean;
  alertDiskPercent: number;
  alertTempEnabled: boolean;
  alertTempLimit: number;
  alertOfflineEnabled: boolean;
};

type AlertSettingsResponse = {
  botTokenConfigured: boolean;
  telegramChatId: string;
  telegramTopicId: string;
  alertCpuPercent: number;
  alertCpuEnabled: boolean;
  alertRamPercent: number;
  alertRamEnabled: boolean;
  alertDiskPercent: number;
  alertDiskEnabled: boolean;
  alertTempLimit: number;
  alertTempEnabled: boolean;
  alertOfflineEnabled: boolean;
  telegramCooldownSeconds: number;
  agents: AgentAlertConfig[];
};

function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent",
        checked ? "bg-accent" : "bg-bg-muted border-border",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
          checked ? "translate-x-4" : "translate-x-0"
        )}
      />
    </button>
  );
}

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

  // Tabs state
  const [alertTab, setAlertTab] = useState<'channel' | 'global' | 'exceptions'>('channel');

  // Channel states
  const [chatId, setChatId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [botToken, setBotToken] = useState('');
  const [clearBotToken, setClearBotToken] = useState(false);
  const [cooldown, setCooldown] = useState('300');

  // Global triggers states
  const [cpu, setCpu] = useState('85');
  const [cpuEnabled, setCpuEnabled] = useState(true);
  const [ram, setRam] = useState('85');
  const [ramEnabled, setRamEnabled] = useState(true);
  const [disk, setDisk] = useState('90');
  const [diskEnabled, setDiskEnabled] = useState(true);
  const [temp, setTemp] = useState('80');
  const [tempEnabled, setTempEnabled] = useState(false);
  const [offlineEnabled, setOfflineEnabled] = useState(true);

  // Expanded server overrides state
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);
  const [agentUseGlobal, setAgentUseGlobal] = useState(true);
  const [agentCpuEnabled, setAgentCpuEnabled] = useState(true);
  const [agentCpuPercent, setAgentCpuPercent] = useState('85');
  const [agentRamEnabled, setAgentRamEnabled] = useState(true);
  const [agentRamPercent, setAgentRamPercent] = useState('85');
  const [agentDiskEnabled, setAgentDiskEnabled] = useState(true);
  const [agentDiskPercent, setAgentDiskPercent] = useState('90');
  const [agentTempEnabled, setAgentTempEnabled] = useState(false);
  const [agentTempLimit, setAgentTempLimit] = useState('80');
  const [agentOfflineEnabled, setAgentOfflineEnabled] = useState(true);

  const [alertsHydrated, setAlertsHydrated] = useState(false);
  const [savingAlerts, setSavingAlerts] = useState(false);
  const [savingAgentSettings, setSavingAgentSettings] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!alertData || alertsHydrated) return;
    setChatId(alertData.telegramChatId);
    setTopicId(alertData.telegramTopicId || '');
    setCpu(String(alertData.alertCpuPercent));
    setCpuEnabled(alertData.alertCpuEnabled !== false);
    setRam(String(alertData.alertRamPercent));
    setRamEnabled(alertData.alertRamEnabled !== false);
    setDisk(String(alertData.alertDiskPercent));
    setDiskEnabled(alertData.alertDiskEnabled !== false);
    setTemp(String(alertData.alertTempLimit ?? 80));
    setTempEnabled(Boolean(alertData.alertTempEnabled));
    setOfflineEnabled(alertData.alertOfflineEnabled !== false);
    setCooldown(String(alertData.telegramCooldownSeconds));
    setAlertsHydrated(true);
  }, [alertData, alertsHydrated]);

  // Load selected agent overrides when expanded
  useEffect(() => {
    if (!expandedAgentId || !alertData?.agents) return;
    const a = alertData.agents.find((x) => x.agentId === expandedAgentId);
    if (!a) return;
    setAgentUseGlobal(a.alertsUseGlobal !== false);
    setAgentCpuEnabled(a.alertCpuEnabled !== false);
    setAgentCpuPercent(String(a.alertCpuPercent ?? 85));
    setAgentRamEnabled(a.alertRamEnabled !== false);
    setAgentRamPercent(String(a.alertRamPercent ?? 85));
    setAgentDiskEnabled(a.alertDiskEnabled !== false);
    setAgentDiskPercent(String(a.alertDiskPercent ?? 90));
    setAgentTempEnabled(Boolean(a.alertTempEnabled));
    setAgentTempLimit(String(a.alertTempLimit ?? 80));
    setAgentOfflineEnabled(a.alertOfflineEnabled !== false);
  }, [expandedAgentId, alertData]);

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
    const nTemp = Math.round(Number(temp));
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
    if (!Number.isFinite(nTemp) || nTemp < 1 || nTemp > 150) {
      return toast.error('Temperature: enter a value between 1 and 150.');
    }
    if (!Number.isFinite(nCd) || nCd < 60 || nCd > 86_400) {
      return toast.error('Cooldown: must be between 60 and 86400 seconds.');
    }

    const body: Record<string, unknown> = {
      telegramChatId: chatId,
      telegramTopicId: topicId,
      alertCpuPercent: nCpu,
      alertCpuEnabled: cpuEnabled,
      alertRamPercent: nRam,
      alertRamEnabled: ramEnabled,
      alertDiskPercent: nDisk,
      alertDiskEnabled: diskEnabled,
      alertTempLimit: nTemp,
      alertTempEnabled: tempEnabled,
      alertOfflineEnabled: offlineEnabled,
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
    setCpuEnabled(out.alertCpuEnabled !== false);
    setRam(String(out.alertRamPercent));
    setRamEnabled(out.alertRamEnabled !== false);
    setDisk(String(out.alertDiskPercent));
    setDiskEnabled(out.alertDiskEnabled !== false);
    setTemp(String(out.alertTempLimit ?? 80));
    setTempEnabled(Boolean(out.alertTempEnabled));
    setOfflineEnabled(out.alertOfflineEnabled !== false);
    setCooldown(String(out.telegramCooldownSeconds));
    setBotToken('');
    setClearBotToken(false);
    toast.success('Telegram alert settings saved');
  };

  const saveAgentAlertOverrides = async (agentId: string) => {
    const nCpu = Math.round(Number(agentCpuPercent));
    const nRam = Math.round(Number(agentRamPercent));
    const nDisk = Math.round(Number(agentDiskPercent));
    const nTemp = Math.round(Number(agentTempLimit));

    if (!Number.isFinite(nCpu) || nCpu < 1 || nCpu > 100) return toast.error('CPU: enter a value between 1 and 100.');
    if (!Number.isFinite(nRam) || nRam < 1 || nRam > 100) return toast.error('RAM: enter a value between 1 and 100.');
    if (!Number.isFinite(nDisk) || nDisk < 1 || nDisk > 100) return toast.error('Disk: enter a value between 1 and 100.');
    if (!Number.isFinite(nTemp) || nTemp < 1 || nTemp > 150) return toast.error('Temp: enter a value between 1 and 150.');

    setSavingAgentSettings(true);
    const res = await fetch(`/api/settings/alerts/agents/${agentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alertsUseGlobal: agentUseGlobal,
        alertCpuEnabled: agentCpuEnabled,
        alertCpuPercent: nCpu,
        alertRamEnabled: agentRamEnabled,
        alertRamPercent: nRam,
        alertDiskEnabled: agentDiskEnabled,
        alertDiskPercent: nDisk,
        alertTempEnabled: agentTempEnabled,
        alertTempLimit: nTemp,
        alertOfflineEnabled: agentOfflineEnabled,
      }),
    });
    const out = await res.json().catch(() => ({}));
    setSavingAgentSettings(false);
    if (!res.ok) {
      return toast.error(out.error ?? 'Failed to save server overrides');
    }
    toast.success('Server overrides saved successfully');
    mutateAlerts();
    setExpandedAgentId(null);
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

      {/* Advanced Telegram Alert Rules (Beszel Vibe) */}
      <div className="card overflow-hidden">
        <div className="border-b border-border bg-bg-soft/30 px-5 py-4 shrink-0">
          <h2 className="flex items-center gap-2 text-base font-bold text-ink">
            <Send className="h-4 w-4 text-accent" />
            Notification Alerts
          </h2>
          <p className="mt-1 text-xs text-ink-muted">
            Configure system alerts globally or specify rule overrides for individual VPS servers.
          </p>
        </div>

        {alertLoading && (
          <div className="flex items-center justify-center py-12 text-ink-muted">
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-accent" />
            Loading settings…
          </div>
        )}
        {alertError && (
          <div className="py-12 text-center text-sm text-danger">
            Failed to load alert rules. Try reloading the dashboard.
          </div>
        )}

        {!alertLoading && alertData && (
          <div>
            {/* Sub-tab Navigation */}
            <div className="flex border-b border-border bg-bg-muted/40 p-1.5 gap-1.5">
              <button
                type="button"
                onClick={() => setAlertTab('channel')}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg transition-all",
                  alertTab === 'channel' ? 'bg-bg-card text-ink shadow-sm' : 'text-ink-soft hover:text-ink'
                )}
              >
                <Send className="h-3.5 w-3.5" />
                Telegram Channel
              </button>
              <button
                type="button"
                onClick={() => setAlertTab('global')}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg transition-all",
                  alertTab === 'global' ? 'bg-bg-card text-ink shadow-sm' : 'text-ink-soft hover:text-ink'
                )}
              >
                <Sliders className="h-3.5 w-3.5" />
                Global Rules
              </button>
              <button
                type="button"
                onClick={() => setAlertTab('exceptions')}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg transition-all",
                  alertTab === 'exceptions' ? 'bg-bg-card text-ink shadow-sm' : 'text-ink-soft hover:text-ink'
                )}
              >
                <Server className="h-3.5 w-3.5" />
                Per-VPS Exceptions
              </button>
            </div>

            {/* Tab contents */}
            <div className="p-5">
              {/* TAB 1: TELEGRAM CHANNEL SETUP */}
              {alertTab === 'channel' && (
                <form onSubmit={saveAlerts} className="space-y-4">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-ink-soft font-semibold">Bot Configuration status:</span>
                    {configured ? (
                      <span className="chip-success text-xs font-bold">Enabled</span>
                    ) : (
                      <span className="chip-muted text-xs font-bold">Not configured</span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <label className="label">Bot Token (from @BotFather)</label>
                      <input
                        type="password"
                        className="input font-mono text-xs"
                        value={botToken}
                        onChange={(e) => setBotToken(e.target.value)}
                        placeholder={alertData.botTokenConfigured ? '•••• keep current token — enter new to replace' : '123456789:ABC...'}
                        autoComplete="off"
                      />
                      {alertData.botTokenConfigured && (
                        <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-ink-muted">
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
                        className="input font-mono text-xs"
                        value={chatId}
                        onChange={(e) => setChatId(e.target.value)}
                        placeholder="-100… or numeric user id"
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <label className="label">Topic ID (Optional)</label>
                      <input
                        className="input font-mono text-xs"
                        value={topicId}
                        onChange={(e) => setTopicId(e.target.value)}
                        placeholder="Enter topic thread ID (e.g. 12)"
                        autoComplete="off"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="label">Alert Cooldown (seconds per server)</label>
                      <input
                        className="input text-xs"
                        type="number"
                        min={60}
                        max={86400}
                        value={cooldown}
                        onChange={(e) => setCooldown(e.target.value)}
                      />
                      <p className="mt-1 text-xs text-ink-soft">
                        Minimum 60 seconds (prevents alert spamming during prolonged usage spikes).
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-border pt-4 flex gap-2">
                    <button type="submit" className="btn-primary text-xs" disabled={savingAlerts}>
                      {savingAlerts && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Save Channel Settings
                    </button>
                    <button
                      type="button"
                      className="btn-secondary text-xs inline-flex items-center gap-2"
                      disabled={testing || !configured}
                      onClick={sendTest}
                    >
                      {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      Send Test Message
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 2: GLOBAL RULES */}
              {alertTab === 'global' && (
                <form onSubmit={saveAlerts} className="space-y-6">
                  <p className="text-xs text-ink-muted italic">
                    These thresholds serve as default rules for all connected VPS servers unless overridden.
                  </p>

                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    {/* CPU alert rule */}
                    <div className="card p-4 bg-bg-card/30 flex items-start gap-4">
                      <div className="pt-0.5">
                        <ToggleSwitch checked={cpuEnabled} onChange={setCpuEnabled} />
                      </div>
                      <div className="flex-grow space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-ink">CPU Overload Alert</span>
                          <span className="text-xs font-semibold text-accent">{cpu}%</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="100"
                          value={cpu}
                          onChange={(e) => setCpu(e.target.value)}
                          disabled={!cpuEnabled}
                          className="w-full h-1.5 bg-bg-muted rounded-lg appearance-none cursor-pointer accent-accent disabled:opacity-30"
                        />
                        <p className="text-xs text-ink-soft">Triggers when system CPU averages over this value.</p>
                      </div>
                    </div>

                    {/* RAM alert rule */}
                    <div className="card p-4 bg-bg-card/30 flex items-start gap-4">
                      <div className="pt-0.5">
                        <ToggleSwitch checked={ramEnabled} onChange={setRamEnabled} />
                      </div>
                      <div className="flex-grow space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-ink">Memory Overload Alert</span>
                          <span className="text-xs font-semibold text-accent">{ram}%</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="100"
                          value={ram}
                          onChange={(e) => setRam(e.target.value)}
                          disabled={!ramEnabled}
                          className="w-full h-1.5 bg-bg-muted rounded-lg appearance-none cursor-pointer accent-accent disabled:opacity-30"
                        />
                        <p className="text-xs text-ink-soft">Triggers when total RAM usage exceeds this threshold.</p>
                      </div>
                    </div>

                    {/* Disk alert rule */}
                    <div className="card p-4 bg-bg-card/30 flex items-start gap-4">
                      <div className="pt-0.5">
                        <ToggleSwitch checked={diskEnabled} onChange={setDiskEnabled} />
                      </div>
                      <div className="flex-grow space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-ink">Disk Space Alert</span>
                          <span className="text-xs font-semibold text-accent">{disk}%</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="100"
                          value={disk}
                          onChange={(e) => setDisk(e.target.value)}
                          disabled={!diskEnabled}
                          className="w-full h-1.5 bg-bg-muted rounded-lg appearance-none cursor-pointer accent-accent disabled:opacity-30"
                        />
                        <p className="text-xs text-ink-soft">Triggers when root disk (/) space exceeds limit.</p>
                      </div>
                    </div>

                    {/* Temperature alert rule */}
                    <div className="card p-4 bg-bg-card/30 flex items-start gap-4">
                      <div className="pt-0.5">
                        <ToggleSwitch checked={tempEnabled} onChange={setTempEnabled} />
                      </div>
                      <div className="flex-grow space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-ink">Temperature Alert</span>
                          <span className="text-xs font-semibold text-accent">{temp}°C</span>
                        </div>
                        <input
                          type="range"
                          min="30"
                          max="110"
                          value={temp}
                          onChange={(e) => setTemp(e.target.value)}
                          disabled={!tempEnabled}
                          className="w-full h-1.5 bg-bg-muted rounded-lg appearance-none cursor-pointer accent-accent disabled:opacity-30"
                        />
                        <p className="text-xs text-ink-soft">Triggers when any hardware sensor exceeds temperature.</p>
                      </div>
                    </div>

                    {/* Server offline alert rule */}
                    <div className="card p-4 bg-bg-card/30 flex items-start gap-4 md:col-span-2">
                      <div className="pt-0.5">
                        <ToggleSwitch checked={offlineEnabled} onChange={setOfflineEnabled} />
                      </div>
                      <div className="flex-grow space-y-0.5">
                        <h4 className="text-xs font-bold text-ink">Heartbeat Timeout (Offline) Alert</h4>
                        <p className="text-xs text-ink-soft">
                          Triggers immediately when the system goes offline or shuts down gracefully.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-border pt-4">
                    <button type="submit" className="btn-primary text-xs" disabled={savingAlerts}>
                      {savingAlerts && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Save Global Rules
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 3: PER-VPS OVERRIDES */}
              {alertTab === 'exceptions' && (
                <div className="space-y-4">
                  <p className="text-xs text-ink-muted italic">
                    Configure server-specific thresholds to override global defaults.
                  </p>

                  {alertData.agents.length === 0 ? (
                    <div className="card p-8 text-center text-xs text-ink-soft italic bg-bg-card/25">
                      No connected servers found. Override configurations will show up once a VPS is registered.
                    </div>
                  ) : (
                    <div className="divide-y divide-border border border-border rounded-xl bg-bg-card/25 overflow-hidden">
                      {alertData.agents.map((agent) => {
                        const isExpanded = expandedAgentId === agent.agentId;
                        const hasCustom = agent.alertsUseGlobal === false;
                        
                        return (
                          <div key={agent.agentId} className="flex flex-col">
                            {/* Accordion Row Header */}
                            <div
                              onClick={() => setExpandedAgentId(isExpanded ? null : agent.agentId)}
                              className="flex items-center justify-between px-4 py-3.5 cursor-pointer hover:bg-bg-soft/45 transition-colors"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <Server className={cn("h-4 w-4 shrink-0", hasCustom ? "text-accent" : "text-ink-soft")} />
                                <div className="truncate">
                                  <span className="text-xs font-bold text-ink">
                                    {agent.label || agent.hostname}
                                  </span>
                                  <span className="ml-2 font-mono text-xs text-ink-soft bg-bg-muted px-1.5 py-0.5 rounded border border-border">
                                    {agent.agentId}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-3">
                                <span
                                  className={cn(
                                    "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border",
                                    hasCustom
                                      ? "chip-success border-success/20"
                                      : "chip-muted border-border"
                                  )}
                                >
                                  {hasCustom ? "Custom Rules" : "Global defaults"}
                                </span>
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4 text-ink-soft" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-ink-soft" />
                                )}
                              </div>
                            </div>

                            {/* Accordion Custom Rule Panel */}
                            {isExpanded && (
                              <div className="px-4 pb-5 pt-1 bg-bg-soft/30 border-t border-border/50 space-y-5 animate-fade-in">
                                <div className="flex items-center gap-3 pt-2">
                                  <ToggleSwitch
                                    checked={!agentUseGlobal}
                                    onChange={(checked) => setAgentUseGlobal(!checked)}
                                  />
                                  <div>
                                    <span className="text-xs font-bold text-ink block">Customize Rules</span>
                                    <span className="text-xs text-ink-muted">
                                      Enable to customize alert parameters for this specific server.
                                    </span>
                                  </div>
                                </div>

                                {!agentUseGlobal && (
                                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 pl-2">
                                    {/* Agent CPU rule */}
                                    <div className="card p-3 bg-bg-card/40 flex items-start gap-3">
                                      <div className="pt-0.5">
                                        <ToggleSwitch checked={agentCpuEnabled} onChange={setAgentCpuEnabled} />
                                      </div>
                                      <div className="flex-grow space-y-1">
                                        <div className="flex justify-between items-center text-xs">
                                          <span className="font-semibold text-ink">CPU Threshold</span>
                                          <span className="font-bold text-accent">{agentCpuPercent}%</span>
                                        </div>
                                        <input
                                          type="range"
                                          min="1"
                                          max="100"
                                          value={agentCpuPercent}
                                          onChange={(e) => setAgentCpuPercent(e.target.value)}
                                          disabled={!agentCpuEnabled}
                                          className="w-full h-1 bg-bg-muted rounded appearance-none cursor-pointer accent-accent"
                                        />
                                      </div>
                                    </div>

                                    {/* Agent RAM rule */}
                                    <div className="card p-3 bg-bg-card/40 flex items-start gap-3">
                                      <div className="pt-0.5">
                                        <ToggleSwitch checked={agentRamEnabled} onChange={setAgentRamEnabled} />
                                      </div>
                                      <div className="flex-grow space-y-1">
                                        <div className="flex justify-between items-center text-xs">
                                          <span className="font-semibold text-ink">RAM Threshold</span>
                                          <span className="font-bold text-accent">{agentRamPercent}%</span>
                                        </div>
                                        <input
                                          type="range"
                                          min="1"
                                          max="100"
                                          value={agentRamPercent}
                                          onChange={(e) => setAgentRamPercent(e.target.value)}
                                          disabled={!agentRamEnabled}
                                          className="w-full h-1 bg-bg-muted rounded appearance-none cursor-pointer accent-accent"
                                        />
                                      </div>
                                    </div>

                                    {/* Agent Disk rule */}
                                    <div className="card p-3 bg-bg-card/40 flex items-start gap-3">
                                      <div className="pt-0.5">
                                        <ToggleSwitch checked={agentDiskEnabled} onChange={setAgentDiskEnabled} />
                                      </div>
                                      <div className="flex-grow space-y-1">
                                        <div className="flex justify-between items-center text-xs">
                                          <span className="font-semibold text-ink">Disk Threshold</span>
                                          <span className="font-bold text-accent">{agentDiskPercent}%</span>
                                        </div>
                                        <input
                                          type="range"
                                          min="1"
                                          max="100"
                                          value={agentDiskPercent}
                                          onChange={(e) => setAgentDiskPercent(e.target.value)}
                                          disabled={!agentDiskEnabled}
                                          className="w-full h-1 bg-bg-muted rounded appearance-none cursor-pointer accent-accent"
                                        />
                                      </div>
                                    </div>

                                    {/* Agent Temp rule */}
                                    <div className="card p-3 bg-bg-card/40 flex items-start gap-3">
                                      <div className="pt-0.5">
                                        <ToggleSwitch checked={agentTempEnabled} onChange={setAgentTempEnabled} />
                                      </div>
                                      <div className="flex-grow space-y-1">
                                        <div className="flex justify-between items-center text-xs">
                                          <span className="font-semibold text-ink">Temperature</span>
                                          <span className="font-bold text-accent">{agentTempLimit}°C</span>
                                        </div>
                                        <input
                                          type="range"
                                          min="30"
                                          max="110"
                                          value={agentTempLimit}
                                          onChange={(e) => setAgentTempLimit(e.target.value)}
                                          disabled={!agentTempEnabled}
                                          className="w-full h-1 bg-bg-muted rounded appearance-none cursor-pointer accent-accent"
                                        />
                                      </div>
                                    </div>

                                    {/* Agent Offline rule */}
                                    <div className="card p-3 bg-bg-card/40 flex items-start gap-3 md:col-span-2">
                                      <div className="pt-0.5">
                                        <ToggleSwitch checked={agentOfflineEnabled} onChange={setAgentOfflineEnabled} />
                                      </div>
                                      <div className="flex-grow">
                                        <span className="text-xs font-semibold text-ink block">Offline Timeout Alert</span>
                                        <p className="text-xs text-ink-soft">Receive warning when this VPS heartbeats cease.</p>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                <div className="flex gap-2">
                                  <button
                                    onClick={() => saveAgentAlertOverrides(agent.agentId)}
                                    disabled={savingAgentSettings}
                                    className="btn-primary text-xs py-1.5 px-3"
                                  >
                                    {savingAgentSettings && <Loader2 className="h-3 w-3 animate-spin" />}
                                    Save Server Settings
                                  </button>
                                  <button
                                    onClick={() => setExpandedAgentId(null)}
                                    className="btn-secondary text-xs py-1.5 px-3"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="card card-pad">
        <h2 className="text-base font-semibold text-ink">Dashboard</h2>
        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wider text-ink-soft">App URL</dt>
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
            <p className="mt-1 text-xs text-ink-soft">
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
      <dt className="text-xs uppercase tracking-wider text-ink-soft">{label}</dt>
      <dd className="truncate text-ink">{value}</dd>
    </div>
  );
}
