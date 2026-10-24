"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Снять лот или заявку на маркете. */
export default function MarketCancelButton({
  type,
  id,
  label = "Снять",
}: {
  type: "listing" | "order";
  id: number;
  label?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    if (!window.confirm("Точно снять?")) return;
    setBusy(true);
    setError(null);
    try {
      const url =
        type === "listing"
          ? `/api/market/listings/${id}/cancel`
          : `/api/market/orders/${id}/cancel`;
      const res = await fetch(url, { method: "POST" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Не удалось снять");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сети");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void cancel()}
        disabled={busy}
        className="mc-btn px-2 py-1 text-[0.62rem] text-[var(--mc-red)] disabled:opacity-55"
      >
        {busy ? "Снимаем…" : label}
      </button>
      {error && <span className="text-[0.6rem] text-[var(--mc-red)]">{error}</span>}
    </div>
  );
}
