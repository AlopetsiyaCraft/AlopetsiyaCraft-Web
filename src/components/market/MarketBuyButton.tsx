"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Кнопка покупки лота на маркете. */
export default function MarketBuyButton({
  listingId,
  priceBld,
  disabled,
}: {
  listingId: number;
  priceBld: number;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buy() {
    if (!window.confirm(`Купить за ${priceBld} BLD?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/market/listings/${listingId}/buy`, { method: "POST" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Не удалось купить");
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
        onClick={() => void buy()}
        disabled={busy || disabled}
        className="mc-btn mc-btn-primary px-3 py-1.5 text-xs disabled:opacity-55"
      >
        {busy ? "Покупаем…" : "Купить"}
      </button>
      {error && <span className="text-[0.6rem] text-[var(--mc-red)]">{error}</span>}
    </div>
  );
}
