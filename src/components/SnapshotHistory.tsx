"use client";

import { useState } from "react";

export interface SnapshotSummary {
  id: number;
  displayNickname: string;
  reason: string;
  capturedAt: number;
  itemCount: number;
  totalCount: number;
  xpLevel: number;
  health: number;
  food: number;
}

interface Props {
  snapshots: SnapshotSummary[];
  nickname: string;
}

const REASON_LABELS: Record<string, string> = {
  join: "вход",
  leave: "выход",
  stop: "остановка сервера",
  periodic: "периодический",
  snapshot: "снимок",
};

/**
 * Админ-панель истории инвентаря: точки снимков и отложенный откат.
 * Откат применяется модом при следующем входе игрока (не мгновенно).
 */
export default function SnapshotHistory({ snapshots, nickname }: Props) {
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function restore(snapshotId: number) {
    const ok = window.confirm(
      "Откатить инвентарь этого игрока к выбранной точке?\n" +
        "Все изменения после неё будут потеряны. Восстановление применится при следующем входе игрока на сервер."
    );
    if (!ok) return;
    setError(null);
    setMessage(null);
    setPendingId(snapshotId);
    try {
      const res = await fetch("/api/inventory/admin/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshotId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Ошибка сервера");
      setMessage(data?.message ?? "Восстановление запланировано.");
      setPendingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка соединения");
      setPendingId(null);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-bold">История инвентаря · {nickname}</h2>

      {message && (
        <div className="px-4 py-3 text-sm text-green-300 border border-green-500/40 bg-green-500/10 rounded-lg">
          ✅ {message}
        </div>
      )}
      {error && (
        <div className="px-4 py-3 text-sm text-red-300 border border-red-500/40 bg-red-500/10 rounded-lg">
          ⛔ {error}
        </div>
      )}

      {snapshots.length === 0 ? (
        <div className="p-6 text-sm text-[var(--text-muted)] border border-[var(--border)] rounded-lg">
          Истории пока нет — снимки появятся при входе/выходе игрока с сервера
          и раз в 10 минут во время игры.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {snapshots.map((s) => (
            <div
              key={s.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 border border-[var(--border)] rounded-lg bg-[var(--card)]"
            >
              <span className="text-sm font-mono text-[var(--text-secondary)]">
                {new Date(s.capturedAt).toLocaleString("ru-RU")}
              </span>
              <span className="text-sm text-[var(--text-muted)]">
                {REASON_LABELS[s.reason] ?? s.reason}
              </span>
              <span className="text-sm">🧰 {s.itemCount} предм.</span>
              <span className="text-sm text-[var(--text-muted)]">
                ✨ ур. {s.xpLevel} · ❤️ {s.health} · 🍖 {s.food}
              </span>
              <div className="ml-auto">
                <button
                  onClick={() => restore(s.id)}
                  disabled={pendingId !== null}
                  className="px-3 py-1.5 text-sm rounded-md bg-red-500/15 text-red-300 border border-red-500/40 hover:bg-red-500/25 disabled:opacity-50 transition-colors"
                >
                  {pendingId === s.id ? "Запланировано…" : "Откатить"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}