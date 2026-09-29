"use client";

import { useState } from "react";
import {
  CHIPS_PER_BLD,
  SELL_CHIPS_PER_BLD,
  bldToChips,
  chipsSpentForBld,
  chipsToBld,
  formatCurrency,
} from "@/lib/currency";

type Direction = "bld" | "chips";

/** Конвертер Болды ↔ Фишки в кошельке. */
export default function WalletExchange({
  initialBld,
  initialChips,
}: {
  initialBld: number;
  initialChips: number;
}) {
  const [bld, setBld] = useState(initialBld);
  const [chips, setChips] = useState(initialChips);
  const [direction, setDirection] = useState<Direction>("bld");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const num = Math.floor(Number(amount));
  const valid = Number.isFinite(num) && num > 0;

  // Живой предпросмотр по правилам конвертера.
  const preview = !valid
    ? null
    : direction === "bld"
      ? { label: "Фишек получишь", value: bldToChips(num), unit: "фишек" }
      : chipsSpentForBld(num) === 0
        ? { label: "Минимум для обмена", value: SELL_CHIPS_PER_BLD, unit: "фишек" }
        : { label: "Болдов получишь", value: chipsToBld(num), unit: "BLD" };

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch("/api/wallet/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: direction, amount: num }),
      });
      const data = (await res.json()) as { bld?: number; chips?: number; error?: string };
      if (!res.ok || data.bld == null || data.chips == null) {
        throw new Error(data.error || "Не удалось обменять");
      }
      setBld(data.bld);
      setChips(data.chips);
      setAmount("");
      setOk(
        direction === "bld"
          ? `Обменяно ${formatCurrency(num)} BLD → ${formatCurrency(bldToChips(num))} фишек`
          : `Обменяно ${formatCurrency(chipsSpentForBld(num))} фишек → ${formatCurrency(chipsToBld(num))} BLD`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Балансы */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-5">
          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <svg className="w-4 h-4 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M14.5 8.5a2.5 2.5 0 0 0-2.5-2.5h-1a2.5 2.5 0 0 0 0 5h2a2.5 2.5 0 0 1 0 5h-3" />
              <path d="M12 5v14" />
            </svg>
            Болды
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-500">
            {formatCurrency(bld)} <span className="text-base font-medium text-[var(--text-muted)]">BLD</span>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1">Покупки на сайте: пластинки и не только.</p>
        </div>

        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-5">
          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <svg className="w-4 h-4 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v10M9 9.5h4a2 2 0 1 0 0-4H9a2 2 0 0 0 0 4zm2.5 5.5h2a2 2 0 1 1 0 4h-4" />
            </svg>
            Фишки
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-500">
            {formatCurrency(chips)} <span className="text-base font-medium text-[var(--text-muted)]">фишек</span>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1">Игра в казино на сервере — только за фишки.</p>
        </div>
      </div>

      {/* Конвертер */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-5">
        <h2 className="text-lg font-bold mb-1">Конвертер</h2>
        <p className="text-sm text-[var(--text-muted)] mb-4">
          1 BLD = {CHIPS_PER_BLD} фишек. Обратно — целыми пачками по {SELL_CHIPS_PER_BLD} фишек.
        </p>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => { setDirection("bld"); setError(null); setOk(null); }}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${direction === "bld" ? "bg-emerald-500 text-white" : "bg-[var(--bg)] text-[var(--text-secondary)] border border-[var(--border)]"}`}
          >
            Болды → Фишки
          </button>
          <button
            onClick={() => { setDirection("chips"); setError(null); setOk(null); }}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${direction === "chips" ? "bg-amber-500 text-white" : "bg-[var(--bg)] text-[var(--text-secondary)] border border-[var(--border)]"}`}
          >
            Фишки → Болды
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)] w-full sm:w-auto">
            Сколько
            <input
              type="number"
              min={1}
              step={1}
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setError(null); setOk(null); }}
              placeholder={direction === "bld" ? "10" : "100"}
              className="flex-1 sm:w-32 px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] text-sm outline-none focus:border-[#7c3aed]"
            />
          </label>
          {preview && (
            <span className="text-sm text-[var(--text-secondary)]">
              {preview.label}: <b className="text-[var(--text)]">{formatCurrency(preview.value)}</b> {preview.unit}
            </span>
          )}
          <button
            onClick={submit}
            disabled={!valid || busy}
            className="px-4 py-2 rounded-lg bg-[#7c3aed] hover:bg-[#6d28d9] disabled:opacity-40 text-white text-sm font-medium transition-colors cursor-pointer"
          >
            {busy ? "Обмениваем…" : "Обменять"}
          </button>
        </div>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        {ok && <p className="mt-3 text-sm text-green-500">{ok}</p>}
      </div>
    </div>
  );
}