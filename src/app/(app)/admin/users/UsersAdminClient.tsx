'use client';

import { useId, useState } from 'react';
import useSWR from 'swr';
import {
  Trash2,
  UserCog,
  Calendar,
  Server,
  Shield,
  UserPlus,
  KeyRound,
  Loader2,
  ScrollText,
} from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ModalFrame } from '@/components/ModalFrame';
import { timeAgo } from '@/lib/utils';

interface UserItem {
  id: string;
  username: string;
  role: 'admin' | 'user';
  createdAt: string;
  vpsCount: number;
}

interface AuditEntry {
  id: string;
  ts: string;
  username: string;
  action: string;
  target: string;
  meta: Record<string, unknown> | null;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error ?? 'Request failed');
  return out;
}

export function UsersAdminClient({ currentUserId }: { currentUserId: string }) {
  const { data, isLoading, mutate } = useSWR<{ users: UserItem[] }>('/api/admin/users', fetcher);
  const { data: auditData, mutate: mutateAudit } = useSWR<{ entries: AuditEntry[] }>(
    '/api/admin/audit?limit=100',
    fetcher
  );
  const [userToDelete, setUserToDelete] = useState<UserItem | null>(null);
  const [roleChange, setRoleChange] = useState<UserItem | null>(null);
  const [resetFor, setResetFor] = useState<UserItem | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const users = data?.users ?? [];
  const refresh = () => {
    void mutate();
    void mutateAudit();
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    try {
      await call(`/api/admin/users/${userToDelete.id}`, 'DELETE');
      toast.success(`Deleted ${userToDelete.username} and all of their data`);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
      throw e;
    }
  };

  const confirmRole = async () => {
    if (!roleChange) return;
    const role = roleChange.role === 'admin' ? 'user' : 'admin';
    try {
      await call(`/api/admin/users/${roleChange.id}`, 'PATCH', { role });
      toast.success(`${roleChange.username} is now ${role}`);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
      throw e;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">User Management</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Create accounts, change roles, reset passwords and review the audit log.
          </p>
        </div>
        <button className="btn-primary text-xs" onClick={() => setCreateOpen(true)}>
          <UserPlus className="h-4 w-4" />
          Add user
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-ink">Accounts</h2>
          <p className="text-xs text-ink-soft">
            {isLoading ? 'Loading…' : `${users.length} account${users.length === 1 ? '' : 's'}`}
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-2 p-5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-16 w-full" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
                  <th className="px-5 py-3">Username</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3">Servers</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((user) => {
                  const isSelf = user.id === currentUserId;
                  return (
                    <tr key={user.id} className="text-sm transition-colors hover:bg-bg-soft/20">
                      <td className="whitespace-nowrap px-5 py-4 font-medium text-ink">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-bg-muted text-ink-soft">
                            <UserCog className="h-4 w-4" />
                          </div>
                          <span>{user.username}</span>
                          {isSelf && <span className="chip chip-success text-[10px] scale-95">You</span>}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">
                        <span className={`chip text-[10px] font-semibold ${user.role === 'admin' ? 'chip-danger' : 'chip-muted'}`}>
                          {user.role === 'admin' && <Shield className="h-3 w-3 inline mr-1 text-danger" />}
                          {user.role === 'admin' ? 'Admin' : 'User'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-ink-soft">
                        <div className="flex items-center gap-1.5 text-xs">
                          <Calendar className="h-3.5 w-3.5 text-ink-soft" />
                          {new Date(user.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">
                        <div className="flex items-center gap-1.5 text-xs text-ink font-medium">
                          <Server className="h-3.5 w-3.5 text-accent" />
                          <span>
                            {user.vpsCount} server{user.vpsCount === 1 ? '' : 's'}
                          </span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => setRoleChange(user)}
                            disabled={isSelf}
                            className="btn-secondary px-2 py-1 text-xs disabled:opacity-30"
                            title={isSelf ? 'You cannot change your own role' : 'Toggle admin role'}
                          >
                            <Shield className="h-3.5 w-3.5" />
                            {user.role === 'admin' ? 'Make user' : 'Make admin'}
                          </button>
                          <button
                            onClick={() => setResetFor(user)}
                            className="btn-secondary px-2 py-1 text-xs"
                            title="Set a new password"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setUserToDelete(user)}
                            disabled={isSelf}
                            className="btn-danger p-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
                            title={isSelf ? 'You cannot delete yourself' : 'Delete user'}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-5 py-4">
          <ScrollText className="h-4 w-4 text-ink-muted" />
          <h2 className="text-base font-semibold text-ink">Audit log</h2>
        </div>
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full text-xs">
            <tbody className="divide-y divide-border/60">
              {(auditData?.entries ?? []).map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap px-5 py-2 text-ink-soft" title={new Date(e.ts).toLocaleString()}>
                    {timeAgo(e.ts)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-medium text-ink">{e.username}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-accent">{e.action}</td>
                  <td className="px-3 py-2 font-mono text-ink-muted break-all">
                    {e.target}
                    {e.meta && Object.keys(e.meta).length > 0 && (
                      <span className="ml-2 text-ink-soft">{JSON.stringify(e.meta)}</span>
                    )}
                  </td>
                </tr>
              ))}
              {(auditData?.entries ?? []).length === 0 && (
                <tr>
                  <td className="px-5 py-8 text-center text-ink-soft">No entries yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CreateUserDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={refresh} />
      <ResetPasswordDialog user={resetFor} onClose={() => setResetFor(null)} onDone={refresh} />

      <ConfirmDialog
        open={roleChange !== null}
        onOpenChange={(o) => !o && setRoleChange(null)}
        title={roleChange?.role === 'admin' ? 'Remove admin role?' : 'Grant admin role?'}
        description={
          <>
            <strong className="text-ink">{roleChange?.username}</strong> will become{' '}
            {roleChange?.role === 'admin' ? 'a regular user' : 'an admin (can manage every account)'}. Their current
            sessions are signed out.
          </>
        }
        confirmLabel="Change role"
        cancelLabel="Cancel"
        tone="default"
        onConfirm={confirmRole}
      />

      <ConfirmDialog
        open={userToDelete !== null}
        onOpenChange={(o) => !o && setUserToDelete(null)}
        title="Delete account?"
        description={
          <div className="space-y-3">
            <p>
              Delete <strong className="text-ink">{userToDelete?.username}</strong>?
            </p>
            <div className="rounded-lg bg-danger/5 border border-danger/20 p-3 text-xs text-danger">
              This permanently removes the account, its {userToDelete?.vpsCount} server(s) and all of their metrics,
              incidents and history. Agents installed on those servers will stop being accepted.
            </div>
          </div>
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        tone="danger"
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function CreateUserDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const titleId = useId();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await call('/api/admin/users', 'POST', { username, password, role });
      toast.success(`Created ${username}`);
      setUsername('');
      setPassword('');
      setRole('user');
      onCreated();
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalFrame open={open} onClose={() => !busy && onClose()} labelledBy={titleId}>
      <form onSubmit={submit} className="card space-y-4 rounded-2xl border border-border bg-bg-card p-5 shadow-2xl">
        <h2 id={titleId} className="text-base font-semibold text-ink">
          Add user
        </h2>
        <div>
          <label className="label">Username</label>
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} maxLength={32} pattern="[a-zA-Z0-9_.\-]+" autoComplete="off" />
        </div>
        <div>
          <label className="label">Password</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
        </div>
        <div>
          <label className="label">Role</label>
          <select className="input" value={role} onChange={(e) => setRole(e.target.value as 'user' | 'admin')}>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Create
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}

function ResetPasswordDialog({ user, onClose, onDone }: { user: UserItem | null; onClose: () => void; onDone: () => void }) {
  const titleId = useId();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      await call(`/api/admin/users/${user.id}`, 'PATCH', { password });
      toast.success(`Password reset for ${user.username}`);
      setPassword('');
      onDone();
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalFrame open={user !== null} onClose={() => !busy && onClose()} labelledBy={titleId}>
      <form onSubmit={submit} className="card space-y-4 rounded-2xl border border-border bg-bg-card p-5 shadow-2xl">
        <h2 id={titleId} className="text-base font-semibold text-ink">
          Reset password for {user?.username}
        </h2>
        <div>
          <label className="label">New password</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
          <p className="mt-1 text-xs text-ink-soft">The user is signed out of every device.</p>
        </div>
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Reset
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}
