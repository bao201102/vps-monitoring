'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Trash2, UserCog, Calendar, Server, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ConfirmDialog';

interface UserItem {
  id: string;
  username: string;
  role: 'admin' | 'user';
  createdAt: string;
  vpsCount: number;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function UsersAdminClient({ currentUserId }: { currentUserId: string }) {
  const { data, isLoading, mutate } = useSWR<{ users: UserItem[] }>('/api/admin/users', fetcher);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserItem | null>(null);

  const users = data?.users ?? [];

  const handleDeleteClick = (user: UserItem) => {
    setUserToDelete(user);
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    try {
      const res = await fetch(`/api/admin/users/${userToDelete.id}`, {
        method: 'DELETE',
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(out.error ?? 'Failed to delete user');
        return;
      }
      toast.success(`Đã xóa thành viên ${userToDelete.username} cùng toàn bộ dữ liệu!`);
      mutate();
    } catch (e) {
      toast.error('Lỗi khi xóa thành viên');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          User Management
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Manage registered SaaS users, their VPS fleets, and delete accounts.
        </p>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-ink">Registered Accounts</h2>
          <p className="text-xs text-ink-soft">
            {isLoading ? 'Loading…' : `${users.length} account${users.length === 1 ? '' : 's'} registered`}
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-2 p-5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-16 w-full" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-ink-soft">
            Chưa có tài khoản nào khác trong hệ thống.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
                  <th className="px-5 py-3">Username</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Registered Date</th>
                  <th className="px-5 py-3">VPS Fleets</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((user) => {
                  const isSelf = user.id === currentUserId;
                  const dateStr = new Date(user.createdAt).toLocaleDateString('vi-VN', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <tr
                      key={user.id}
                      className="text-sm transition-colors hover:bg-bg-soft/20"
                    >
                      <td className="whitespace-nowrap px-5 py-4 font-medium text-ink">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-bg-muted text-ink-soft">
                            <UserCog className="h-4 w-4" />
                          </div>
                          <span>{user.username}</span>
                          {isSelf && (
                            <span className="chip chip-success text-[10px] scale-95">You</span>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">
                        <span
                          className={`chip text-[10px] font-semibold ${
                            user.role === 'admin'
                              ? 'chip-danger'
                              : 'chip-muted'
                          }`}
                        >
                          {user.role === 'admin' ? (
                            <Shield className="h-3 w-3 inline mr-1 text-danger" />
                          ) : null}
                          {user.role === 'admin' ? 'Admin' : 'User'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-ink-soft">
                        <div className="flex items-center gap-1.5 text-xs">
                          <Calendar className="h-3.5 w-3.5 text-ink-soft" />
                          {dateStr}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">
                        <div className="flex items-center gap-1.5 text-xs text-ink font-medium">
                          <Server className="h-3.5 w-3.5 text-accent" />
                          <span>{user.vpsCount} server{user.vpsCount === 1 ? '' : 's'}</span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right">
                        <button
                          onClick={() => handleDeleteClick(user)}
                          disabled={isSelf}
                          className="btn-danger p-1.5 disabled:opacity-30 disabled:cursor-not-allowed inline-flex items-center gap-1"
                          title={isSelf ? 'Không thể tự xóa bản thân' : 'Xóa thành viên'}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Xóa tài khoản thành viên?"
        description={
          <div className="space-y-3">
            <p>
              Bạn có chắc chắn muốn xóa tài khoản{' '}
              <strong className="text-ink">{userToDelete?.username}</strong>?
            </p>
            <div className="rounded-lg bg-danger/5 border border-danger/20 p-3 text-xs text-danger">
              <strong>CẢNH BÁO NGUY HIỂM:</strong> Hành động này sẽ xóa vĩnh viễn:
              <ul className="list-disc pl-5 mt-1 space-y-1">
                <li>Tài khoản người dùng.</li>
                <li>
                  Tất cả{' '}
                  <strong>
                    {userToDelete?.vpsCount} máy chủ VPS
                  </strong>{' '}
                  thuộc về người dùng này.</li>
                <li>Toàn bộ lịch sử đo lường (metrics) của các VPS đó.</li>
              </ul>
            </div>
            <p className="text-xs text-ink-soft">
              Hành động này không thể hoàn tác. Vui lòng cân nhắc kỹ.
            </p>
          </div>
        }
        confirmLabel="Xóa dữ liệu"
        cancelLabel="Huỷ"
        tone="danger"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
