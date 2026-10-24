"use client";

import { useState } from "react";

export default function EconomyForm({ usersCount }: { usersCount: number }) {
  const [currency, setCurrency] = useState<"bld" | "chips">("bld");
  const [audience, setAudience] = useState<"all" | "users" | "admins">("all");
  const [amount, setAmount] = useState("100");
  const [reason, setReason] = useState("Награда за сезон");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const numeric = Number(amount);
  const estimate =
    Number.isFinite(numeric) && numeric !== 0 ? Math.round(numeric * usersCount) : 0;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!window.confirm("Применить изменение ко всем выбранным игрокам?")) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/economy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency, audience, amount: Number(amount), reason }),
      });
      const data = (await res.json()) as {
        error?: string;
        message?: string;
        affected?: number;
        totalChange?: number;
      };
      if (!res.ok) throw new Error(data.error || "Не удалось применить");
      setMessage(
        `${data.message ?? "Готово"}: игроков ${data.affected ?? 0}, изменение ${data.totalChange ?? 0}`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сети");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mc-panel flex flex-col gap-3 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-[0.58rem] uppercase tracking-[0.1em] text-[var(--text-muted)]">
          Валюта
          <select
            value={currency}
            onChange={(event) => setCurrency(event.target.value === "chips" ? "chips" : "bld")}
            className="mc-input py-1 text-xs"
          >
            <option value="bld">BLD</option>
            <option value="chips">Фишки</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[0.58rem] uppercase tracking-[0.1em] text-[var(--text-muted)]">
          Кому
          <select
            value={audience}
            onChange={(event) =>
              setAudience(
                event.target.value === "admins"
                  ? "admins"
                  : event.target.value === "users"
                    ? "users"
                    : "all"
              )
            }
            className="mc-input py-1 text-xs"
          >
            <option value="all">Всем игрокам</option>
            <option value="users">Только игрокам</option>
            <option value="admins">Только админам</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[0.58rem] uppercase tracking-[0.1em] text-[var(--text-muted)]">
          Сумма (минус — списать)
          <input
            type="number"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="mc-input py-1 text-xs"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-[0.58rem] uppercase tracking-[0.1em] text-[var(--text-muted)]">
          Причина
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="mc-input py-1 text-xs"
            maxLength={200}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy || !Number.isInteger(Number(amount)) || Number(amount) === 0}
          className="mc-btn mc-btn-primary px-3 py-1.5 text-xs disabled:opacity-55"
        >
          {busy ? "Применяем…" : "Применить"}
        </button>
        <span className="text-xs text-[var(--text-muted)]">
          Игроков: {usersCount} · всего изменится примерно на {estimate}
        </span>
      </div>

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
      <p className="text-[0.6rem] text-[var(--text-muted)]">
        Баланс не уходит ниже нуля. Каждое изменение попадает в историю операций
        и аудит-лог.
      </p>
    </form>
  );
}
