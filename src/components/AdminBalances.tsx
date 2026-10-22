"use client";

import { useState } from "react";

/** Форма начисления/списания BLD и фишек через существующие admin API. */
export default function AdminBalances() {
  const [nickname, setNickname] = useState("");
  const [currency, setCurrency] = useState<"bld" | "chips">("bld");
  const [amount, setAmount] = useState("100");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const value = Math.trunc(Number(amount));
      if (!Number.isFinite(value) || value === 0) {
        throw new Error("Сумма должна быть целым числом, кроме 0");
      }
      const res = await fetch(`/api/admin/${currency}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nickname.trim(), amount: value }),
      });
      const data = (await res.json()) as {
        error?: string;
        bld?: number;
        chips?: number;
      };
      if (!res.ok) throw new Error(data.error || "Не удалось изменить баланс");
      const balance = currency === "bld" ? data.bld : data.chips;
      setMessage(
        `${value > 0 ? "Начислено" : "Списано"} ${Math.abs(value)} ${
          currency === "bld" ? "BLD" : "фишек"
        } игроку ${nickname.trim()}. Баланс: ${balance ?? "—"}.`
      );
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mc-panel overflow-hidden">
      <div className="mc-head">Балансы</div>
      <form onSubmit={submit} className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)] sm:col-span-2">
          Ник игрока
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            required
            placeholder="Steve"
            className="mc-input"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
          Валюта
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as "bld" | "chips")}
            className="mc-input"
          >
            <option value="bld">BLD</option>
            <option value="chips">Фишки</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
          Сумма (+ / −)
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mc-input"
          />
        </label>
        <div className="sm:col-span-4">
          <button
            type="submit"
            disabled={busy}
            className="mc-btn mc-btn-primary px-4 py-2 text-xs"
          >
            {busy ? "Применяем…" : "Применить"}
          </button>
        </div>
      </form>
      {error && (
        <p className="mx-4 mb-4 border-2 border-black bg-[rgba(214,69,69,0.14)] px-3 py-2 text-sm text-[var(--mc-red)]">
          {error}
        </p>
      )}
      {message && (
        <p className="mx-4 mb-4 border-2 border-black bg-[rgba(93,156,60,0.16)] px-3 py-2 text-sm text-[var(--mc-green-light)]">
          {message}
        </p>
      )}
    </section>
  );
}
