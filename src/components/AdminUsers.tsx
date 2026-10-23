"use client";

import { useState } from "react";

export interface AdminUserRow {
  id: number;
  nickname: string;
  role: "user" | "moderator" | "admin";
  bld: number;
  chips: number;
  createdAt: string;
  lastActiveAt: string | null;
  bannedAt: string | null;
  banReason: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  user: "Игрок",
  moderator: "Модератор",
  admin: "Админ",
};

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

  async function patch(
    id: number,
    body: { role?: AdminUserRow["role"]; banned?: boolean; banReason?: string }
  ) {
    setBusyId(id);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Не удалось применить");
      setUsers((prev) =>
        prev.map((u) =>
          u.id === id
            ? {
                ...u,
                ...(typeof body.role === "string" ? { role: body.role } : {}),
                ...(typeof body.banned === "boolean"
                  ? {
                      bannedAt: body.banned ? new Date().toISOString() : null,
                      banReason:
                        body.banned && typeof body.banReason === "string"
                          ? body.banReason
                          : null,
                    }
                  : {}),
              }
            : u
        )
      );
      setMessage("Сохранено");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusyId(null);
    }
  }

  function toggleBan(user: AdminUserRow) {
    if (user.bannedAt) {
      void patch(user.id, { banned: false });
      return;
    }
    const reason = window.prompt(
      `Причина бана ${user.nickname}? (можно оставить пустой)`,
      ""
    );
    if (reason === null) return;
    void patch(user.id, { banned: true, banReason: reason });
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
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-[var(--card-alt)] text-[0.6rem] uppercase tracking-[0.12em] text-[var(--text-muted)]">
              <tr>
                <th className="px-3 py-2">Игрок</th>
                <th className="px-3 py-2">Роль</th>
                <th className="px-3 py-2">Баланс</th>
                <th className="px-3 py-2">Регистрация</th>
                <th className="px-3 py-2">Заходил</th>
                <th className="px-3 py-2">Статус</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-black/40">
              {users.map((user) => {
                const isSelf = user.id === selfId;
                const banned = !!user.bannedAt;
                return (
                  <tr key={user.id} className={banned ? "bg-[rgba(214,69,69,0.06)]" : undefined}>
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
                        onChange={(e) =>
                          void patch(user.id, {
                            role: e.target.value as AdminUserRow["role"],
                          })
                        }
                        className="mc-input py-1 text-xs disabled:opacity-60"
                      >
                        {Object.entries(ROLE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
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
                    <td className="px-3 py-2">
                      {banned ? (
                        <span
                          className="mc-chip text-[0.6rem] text-[var(--mc-red)]"
                          title={user.banReason ?? "Без причины"}
                        >
                          Забанен
                        </span>
                      ) : (
                        <span className="mc-chip text-[0.6rem] text-[var(--mc-green-light)]">
                          Активен
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {!isSelf && (
                        <button
                          type="button"
                          onClick={() => toggleBan(user)}
                          disabled={busyId === user.id}
                          className={`mc-btn px-2 py-1 text-[0.6rem] ${
                            banned ? "text-[var(--mc-green-light)]" : "text-[var(--mc-red)]"
                          }`}
                        >
                          {banned ? "Разбанить" : "Забанить"}
                        </button>
                      )}
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
