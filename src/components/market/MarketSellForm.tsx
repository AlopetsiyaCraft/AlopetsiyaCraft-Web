"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export interface SellableItem {
  container: string;
  slot: number;
  material: string;
  title: string;
  icon: string;
  count: number;
}

/** Выбор предмета из инвентаря и выставление лота. */
export default function MarketSellForm({ items }: { items: SellableItem[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState(0);
  const [price, setPrice] = useState("100");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [soldTo, setSoldTo] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <div className="mc-inset p-6 text-sm text-[var(--text-muted)]">
        В сохранённом инвентаре нет предметов. Зайди на сервер и выйди, чтобы
        обновить снимок.
      </div>
    );
  }

  const item = items[selected] ?? items[0];

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    setSoldTo(null);
    try {
      const res = await fetch("/api/market/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          container: item.container,
          slot: item.slot,
          priceBld: Number(price),
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        message?: string;
        soldTo?: string | null;
      };
      if (!res.ok) throw new Error(data.error || "Не удалось выставить лот");
      setMessage(data.message ?? "Лот выставлен");
      setSoldTo(data.soldTo ?? null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сети");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((entry, index) => {
          const active = index === selected;
          return (
            <button
              key={`${entry.container}-${entry.slot}`}
              type="button"
              onClick={() => setSelected(index)}
              className={`flex min-w-0 items-center gap-2 border-2 p-2 text-left transition-colors ${
                active
                  ? "border-[var(--mc-green-light)] bg-[var(--hover)]"
                  : "border-black bg-[var(--card)] hover:bg-[var(--hover)]"
              }`}
            >
              <span className="mc-inset flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden">
                {entry.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={entry.icon} alt="" className="h-7 w-7 pixelated" />
                ) : (
                  "📦"
                )}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[0.7rem]">{entry.title}</span>
                <span className="block font-mono text-[0.55rem] text-[var(--text-muted)]">
                  {entry.count} шт. · {entry.container}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mc-inset flex flex-wrap items-center gap-3 p-3">
        <span className="mc-inset flex h-12 w-12 items-center justify-center overflow-hidden">
          {item.icon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.icon} alt="" className="h-9 w-9 pixelated" />
          ) : (
            "📦"
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{item.title}</div>
          <div className="font-mono text-[0.6rem] text-[var(--text-muted)]">
            {item.material} · {item.count} шт.
          </div>
        </div>
        <label className="flex flex-col gap-1 text-[0.58rem] uppercase tracking-[0.1em] text-[var(--text-muted)]">
          Цена, BLD
          <input
            type="number"
            min={1}
            max={1_000_000}
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            className="mc-input w-32 py-1 text-xs"
            required
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="mc-btn mc-btn-primary px-3 py-1.5 text-xs disabled:opacity-55"
        >
          {busy ? "Выставляем…" : "Выставить лот"}
        </button>
      </div>

      {error && (
        <p className="border-2 border-black bg-[rgba(214,69,69,0.14)] px-3 py-2 text-sm text-[var(--mc-red)]">
          {error}
        </p>
      )}
      {message && (
        <p className="border-2 border-black bg-[rgba(93,156,60,0.16)] px-3 py-2 text-sm text-[var(--mc-green-light)]">
          {message}
          {soldTo ? (
            <> Лот сразу купил {soldTo}.</>
          ) : (
            <>
              {" "}
              <Link
                href={`/market/${encodeURIComponent(item.material)}`}
                className="underline"
              >
                Открыть предмет
              </Link>
            </>
          )}
        </p>
      )}

      <p className="text-xs text-[var(--text-muted)]">
        Один предмет списывается из последнего снимка инвентаря и хранится на
        маркете до продажи или отмены. Комиссия маркета — 5% с продажи.
      </p>
    </form>
  );
}
