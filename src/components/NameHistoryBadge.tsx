"use client";

import { useState } from "react";

interface PreviousName {
  id: number;
  nickname: string;
}

/**
 * Значок «Ранее известен как…». Раньше он разворачивался в потоке и из-за
 * этого ник прыгал вверх-вниз. Теперь кнопка фиксированная, а подсказка
 * висит абсолютно справа и не влияет на раскладку.
 * Имена дедуплицируются без учёта регистра.
 */
export default function NameHistoryBadge({ names }: { names: PreviousName[] }) {
  const [expanded, setExpanded] = useState(false);

  const unique = Array.from(
    new Map(names.map((n) => [n.nickname.toLowerCase(), n])).values()
  );
  if (unique.length === 0) return null;

  return (
    <div
      className="relative inline-flex shrink-0 items-center"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex h-7 w-7 cursor-pointer items-center justify-center border-2 border-transparent text-[var(--text-muted)] transition-colors hover:border-black hover:bg-[var(--card-alt)] hover:text-[var(--text-secondary)]"
        aria-label="Старые никнеймы"
        aria-expanded={expanded}
      >
        <svg
          className="h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 576 512"
          fill="currentColor"
          fillRule="evenodd"
        >
          <path d="M64 32C28.7 32 0 60.7 0 96L0 416c0 35.3 28.7 64 64 64l448 0c35.3 0 64-28.7 64-64l0-320c0-35.3-28.7-64-64-64L64 32zm80 256l64 0c44.2 0 80 35.8 80 80 0 8.8-7.2 16-16 16L80 384c-8.8 0-16-7.2-16-16 0-44.2 35.8-80 80-80zm-24-96a56 56 0 1 1 112 0 56 56 0 1 1 -112 0zm240-48l112 0c13.3 0 24 10.7 24 24s-10.7 24-24 24l-112 0c-13.3 0-24-10.7-24-24s10.7-24 24-24zm0 96l112 0c13.3 0 24 10.7 24 24s-10.7 24-24 24l-112 0c-13.3 0-24-10.7-24-24s10.7-24 24-24z" />
        </svg>
      </button>

      {expanded && (
        <div className="absolute left-full top-1/2 z-50 ml-1 w-max max-w-[min(20rem,70vw)] -translate-y-1/2 border-2 border-black bg-[var(--card-alt)] px-3 py-2 text-[11px] leading-snug text-[var(--text-secondary)] shadow-[3px_3px_0_rgba(0,0,0,0.45)]">
          <span className="text-[var(--text-muted)]">Ранее известен как </span>
          <span className="break-words font-semibold text-[var(--text)]">
            {unique.map((n) => n.nickname).join(", ")}
          </span>
        </div>
      )}
    </div>
  );
}
