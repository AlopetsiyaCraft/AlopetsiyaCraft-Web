"use client";

import { useState } from "react";

export interface AdminUserRow {
  id: number;
  nickname: string;
  role: "user" | "admin";
  bld: number;
  chips: number;
  createdAt: string;
  lastActiveAt: string | null;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(date);
}

export default function AdminUsers({
  initialUsers,
  selfId,
}: {
  initialUsers: AdminUserRow[];
  selfId: number;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function setRole(id: number, role: AdminUserRow["role"]) {
    setBusyId(id);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Не удалось применить");
      setUsers((prev) => prev.map((user) => (user.id === id ? { ...user, role } : user)));
      setMessage("Сохранено");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p className="border-2 border-black bg-[rgba(214,69,69,0.14)] px-3 py-2 text-sm text-[var(--mc-red)]">
          {error}
        </p>
      )}
      {message && (
        <p className="border-2 border-black bg-[rgba(93,156,60,0.16)] px-3 py-2 text-sm text-[var(--mc-green-light)]">
          {message}
        </p>
      )}

      <section className="mc-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-[var(--card-alt)] text-[0.6rem] uppercase tracking-[0.12em] text-[var(--text-muted)]">
              <tr>
                <th className="px-3 py-2">Игрок</th>
                <th className="px-3 py-2">Роль</th>
                <th className="px-3 py-2">Баланс</th>
                <th className="px-3 py-2">Регистрация</th>
                <th className="px-3 py-2">Заходил</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-black/40">
              {users.map((user) => {
                const isSelf = user.id === selfId;
                return (
                  <tr key={user.id}>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{user.nickname}</span>
                        {isSelf && (
                          <span className="mc-chip text-[0.55rem] text-[var(--mc-green-light)]">
                            вы
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-[0.58rem] text-[var(--text-muted)]">
                        id {user.id}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={user.role}
                        disabled={isSelf || busyId === user.id}
                        onChange={(event) =>
                          void setRole(
                            user.id,
                            event.target.value as AdminUserRow["role"]
                          )
                        }
                        className="mc-input py-1 text-xs disabled:opacity-60"
                      >
                        <option value="user">Игрок</option>
                        <option value="admin">Админ</option>
                      </select>
                    </td>
                    <td className="px-3 py-2 font-mono text-[0.68rem]">
                      <div className="text-[var(--mc-gold)]">{user.bld} BLD</div>
                      <div className="text-[var(--mc-green-light)]">{user.chips} фишек</div>
                    </td>
                    <td className="px-3 py-2 font-mono text-[0.62rem] text-[var(--text-muted)]">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-3 py-2 font-mono text-[0.62rem] text-[var(--text-muted)]">
                      {formatDate(user.lastActiveAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {users.length === 0 && (
          <div className="p-6 text-sm text-[var(--text-muted)]">Никого не найден.</div>
        )}
      </section>
    </div>
  );
}
