"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type AdminUser = {
  id: number;
  email: string;
  phone: string;
  username: string;
  is_authorised: boolean;
  created_at: string;
  self_introduction: string | null;
};

type ApiUsersResponse = {
  users?: AdminUser[];
  error?: string;
};

type ApiUserResponse = {
  user?: AdminUser;
  error?: string;
};

type ApiDeleteResponse = {
  success?: boolean;
  deletedUserId?: number;
  error?: string;
};

export default function AdminUserClient() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [pendingUserId, setPendingUserId] = useState<number | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/users", { cache: "no-store" });
      const data = (await response.json()) as ApiUsersResponse;
      if (!response.ok || !Array.isArray(data.users)) {
        setMessage(data.error ?? "Failed to fetch users");
        setUsers([]);
        return;
      }
      setUsers(data.users);
    } catch (error) {
      console.error(error);
      setMessage("Failed to fetch users");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => a.id - b.id),
    [users]
  );

  const formatDateTime = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  };

  const handleToggleAuthorised = async (user: AdminUser) => {
    setPendingUserId(user.id);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAuthorised: !user.is_authorised }),
      });
      const data = (await response.json()) as ApiUserResponse;
      if (!response.ok || !data.user) {
        setMessage(data.error ?? "Failed to update authorised status");
        return;
      }
      setUsers((current) =>
        current.map((entry) => (entry.id === data.user!.id ? data.user! : entry))
      );
    } catch (error) {
      console.error(error);
      setMessage("Failed to update authorised status");
    } finally {
      setPendingUserId(null);
    }
  };

  const handleDeleteUser = async (user: AdminUser) => {
    const confirmed = window.confirm(
      `Delete user "${user.username}" (id=${user.id})?\nThis will remove user resources first, then delete the user.`
    );
    if (!confirmed) return;

    setPendingUserId(user.id);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as ApiDeleteResponse;
      if (!response.ok || !data.success) {
        setMessage(data.error ?? "Failed to delete user");
        return;
      }
      setUsers((current) => current.filter((entry) => entry.id !== user.id));
    } catch (error) {
      console.error(error);
      setMessage("Failed to delete user");
    } finally {
      setPendingUserId(null);
    }
  };

  if (loading) {
    return <p className="text-slate-300">Loading users...</p>;
  }

  return (
    <div className="space-y-4">
      {message ? (
        <div className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {message}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-slate-700 bg-slate-900/80">
        <table className="min-w-[980px] w-full text-left text-xs text-slate-200">
          <thead className="bg-slate-800/80 text-[11px] uppercase tracking-wide text-slate-300">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Username</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Phone</th>
              <th className="px-3 py-2">Authorised</th>
              <th className="px-3 py-2">Created At</th>
              <th className="px-3 py-2">Self Introduction</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedUsers.map((user) => {
              const pending = pendingUserId === user.id;
              return (
                <tr key={user.id} className="border-t border-slate-800 align-top">
                  <td className="px-3 py-2 font-mono">{user.id}</td>
                  <td className="px-3 py-2 font-semibold">{user.username}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{user.email}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{user.phone}</td>
                  <td className="px-3 py-2">{user.is_authorised ? "Yes" : "No"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {formatDateTime(user.created_at)}
                  </td>
                  <td className="px-3 py-2 break-words max-w-[320px]">
                    {user.self_introduction || "-"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => void handleToggleAuthorised(user)}
                        className="rounded-md border border-slate-500 bg-slate-800 px-3 py-1 text-xs text-slate-100 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {user.is_authorised ? "Cancel Authorised" : "Set Authorised"}
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => void handleDeleteUser(user)}
                        className="rounded-md border border-rose-500/60 bg-rose-800/50 px-3 py-1 text-xs text-rose-100 transition-colors hover:bg-rose-700/70 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Delete User
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
