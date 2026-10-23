"use client";

import { useEffect, useState } from "react";

const ADDRESS = process.env.NEXT_PUBLIC_MC_ADDRESS || "192.168.0.187:25565";

/** Кнопка с IP сервера: копирует адрес в буфер и показывает «Скопировано». */
export default function ServerIp({ compact = false }: { compact?: boolean }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(ADDRESS);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (compact) {
    return (
      <button onClick={copy} className="mc-chip cursor-pointer font-mono hover:bg-[var(--hover)]" title="Скопировать IP">
        <span className="h-2 w-2 bg-[var(--mc-green-light)]" aria-hidden />
        {copied ? "СКОПИРОВАНО" : ADDRESS}
      </button>
    );
  }

  return (
    <button
      onClick={copy}
      className="mc-panel-flat group flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[var(--hover)] sm:w-auto"
      title="Скопировать IP сервера"
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <span className="mc-chip shrink-0 text-[0.6rem] text-[var(--mc-green-light)]">IP</span>
        <span className="truncate font-mono text-sm text-[var(--text)] sm:text-lg">{ADDRESS}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5 text-[0.7rem] uppercase tracking-wider text-[var(--text-muted)] group-hover:text-[var(--mc-green-light)]">
        {copied ? (
          <svg className="h-4 w-4 text-[var(--mc-green-light)]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="square" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="square" d="M8 5H5v14h14v-3M9 3h12v12H9z" />
          </svg>
        )}
        {copied ? "Готово" : <span className="hidden sm:inline">Копировать</span>}
      </span>
    </button>
  );
}
