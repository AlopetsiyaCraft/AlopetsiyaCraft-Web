"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Заявка на покупку предмета: BLD резервируются до исполнения. */
export default function MarketOrderForm({
  itemKey,
  suggestedPrice,
  isLoggedIn,
}: {
  itemKey: string;
  suggestedPrice: number;
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const [price, setPrice] = useState(String(suggestedPrice || 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!isLoggedIn) {
    return (
      <p className="text-xs text-[var(--text-muted)]">
        <a href="/auth/login" className="text-[var(--mc-green-light)] underline">
          Войди
        </a>{" "}
        чтобы создать заявку на покупку.
      </p>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/market/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemKey, priceBld: Number(price) }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) throw new Error(data.error || "Не удалось создать заявку");
      setMessage(data.message ?? "Заявка создана");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сети");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <div className="flex items-end gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-[0.58rem] uppercase tracking-[0.1em] text-[var(--text-muted)]">
          Цена заявки, BLD
          <input
            type="number"
            min={1}
            max={1_000_000}
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            className="mc-input py-1 text-xs"
            required
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="mc-btn mc-btn-primary px-3 py-1.5 text-xs disabled:opacity-55"
        >
          {busy ? "Создаём…" : "Купить по цене"}
        </button>
      </div>
      {error && <p className="text-xs text-[var(--mc-red)]">{error}</p>}
      {message && <p className="text-xs text-[var(--mc-green-light)]">{message}</p>}
      <p className="text-[0.6rem] text-[var(--text-muted)]">
        BLD резервируются сразу. Если подходящий лот дешевле — разницу вернём.
      </p>
    </form>
  );
}
