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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="mc-panel p-5">
          <div className="flex items-center gap-2 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
            <span className="mc-panel-flat flex h-7 w-7 items-center justify-center">
              <svg className="h-4 w-4 text-[var(--mc-green-light)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M14.5 8.5a2.5 2.5 0 0 0-2.5-2.5h-1a2.5 2.5 0 0 0 0 5h2a2.5 2.5 0 0 1 0 5h-3" />
                <path d="M12 5v14" />
              </svg>
            </span>
            Болды
          </div>
          <div className="mt-3 font-mono text-3xl leading-none text-[var(--mc-green-light)]">
            {formatCurrency(bld)}
            <span className="ml-1.5 text-sm text-[var(--text-muted)]">BLD</span>
          </div>
          <p className="mt-2 text-xs text-[var(--text-muted)]">Покупки на сайте: пластинки и не только.</p>
        </div>

        <div className="mc-panel p-5">
          <div className="flex items-center gap-2 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
            <span className="mc-panel-flat flex h-7 w-7 items-center justify-center">
              <svg className="h-4 w-4 text-[var(--mc-gold)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v10M9 9.5h4a2 2 0 1 0 0-4H9a2 2 0 0 0 0 4zm2.5 5.5h2a2 2 0 1 1 0 4h-4" />
              </svg>
            </span>
            Фишки
          </div>
          <div className="mt-3 font-mono text-3xl leading-none text-[var(--mc-gold)]">
            {formatCurrency(chips)}
            <span className="ml-1.5 text-sm text-[var(--text-muted)]">фишек</span>
          </div>
          <p className="mt-2 text-xs text-[var(--text-muted)]">Казино на сервере — только за фишки.</p>
        </div>
      </div>

      {/* Конвертер */}
      <div className="mc-panel overflow-hidden">
        <div className="mc-head">Конвертер</div>
        <div className="p-5">
          <p className="mb-4 text-sm text-[var(--text-muted)]">
            1 BLD = {CHIPS_PER_BLD} фишек. Обратно — целыми пачками по {SELL_CHIPS_PER_BLD} фишек.
          </p>

          <div className="mb-4 flex gap-2">
            <button
              onClick={() => { setDirection("bld"); setError(null); setOk(null); }}
              className={`flex-1 cursor-pointer border-2 px-3 py-2 text-[0.72rem] font-bold uppercase tracking-[0.08em] transition-colors ${
                direction === "bld"
                  ? "border-black bg-[var(--mc-green)] text-[#0f1a08]"
                  : "border-black bg-[var(--bg)] text-[var(--text-secondary)] hover:bg-[var(--hover)]"
              }`}
            >
              Болды → Фишки
            </button>
            <button
              onClick={() => { setDirection("chips"); setError(null); setOk(null); }}
              className={`flex-1 cursor-pointer border-2 px-3 py-2 text-[0.72rem] font-bold uppercase tracking-[0.08em] transition-colors ${
                direction === "chips"
                  ? "border-black bg-[var(--mc-gold)] text-[#1a1400]"
                  : "border-black bg-[var(--bg)] text-[var(--text-secondary)] hover:bg-[var(--hover)]"
              }`}
            >
              Фишки → Болды
            </button>
          </div>

          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <label className="flex w-full items-center gap-2 text-sm text-[var(--text-secondary)] sm:w-auto">
              <span className="shrink-0 text-[0.7rem] uppercase tracking-wider text-[var(--text-muted)]">Сколько</span>
              <input
                type="number"
                min={1}
                step={1}
                value={amount}
                onChange={(e) => { setAmount(e.target.value); setError(null); setOk(null); }}
                placeholder={direction === "bld" ? "10" : "100"}
                className="mc-input flex-1 sm:w-32"
              />
            </label>
            {preview && (
              <span className="text-sm text-[var(--text-secondary)]">
                {preview.label}: <b className="font-mono text-[var(--text)]">{formatCurrency(preview.value)}</b> {preview.unit}
              </span>
            )}
            <button
              onClick={submit}
              disabled={!valid || busy}
              className="mc-btn mc-btn-primary text-xs sm:ml-auto"
            >
              {busy ? "Обмениваем…" : "Обменять"}
            </button>
          </div>

          {error && <p className="mt-3 text-sm text-[var(--mc-red)]">{error}</p>}
          {ok && <p className="mt-3 text-sm text-[var(--mc-green-light)]">{ok}</p>}
        </div>
      </div>
    </div>
  );
}