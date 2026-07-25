"use client";

import { useState } from "react";

interface PreviousName {
  id: number;
  nickname: string;
}

export default function NameHistoryBadge({ names }: { names: PreviousName[] }) {
  const [expanded, setExpanded] = useState(false);

  if (names.length === 0) return null;

  return (
    <div
      className="inline-flex items-center relative"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      <div
        className="flex items-center gap-1.5 rounded cursor-default transition-all duration-200 overflow-hidden"
        style={{
          height: 28,
          backgroundColor: expanded ? "var(--bg-alt)" : "transparent",
          border: expanded ? "1px solid var(--border)" : "1px solid transparent",
          width: expanded ? "auto" : 28,
          padding: expanded ? "0 12px 0 8px" : "0",
        }}
      >
        <svg
          className="flex-shrink-0"
          style={{ width: 16, height: 16, color: "var(--text-muted)" }}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 576 512"
          fill="currentColor"
          fillRule="evenodd"
        >
          <path d="M64 32C28.7 32 0 60.7 0 96L0 416c0 35.3 28.7 64 64 64l448 0c35.3 0 64-28.7 64-64l0-320c0-35.3-28.7-64-64-64L64 32zm80 256l64 0c44.2 0 80 35.8 80 80 0 8.8-7.2 16-16 16L80 384c-8.8 0-16-7.2-16-16 0-44.2 35.8-80 80-80zm-24-96a56 56 0 1 1 112 0 56 56 0 1 1 -112 0zm240-48l112 0c13.3 0 24 10.7 24 24s-10.7 24-24 24l-112 0c-13.3 0-24-10.7-24-24s10.7-24 24-24zm0 96l112 0c13.3 0 24 10.7 24 24s-10.7 24-24 24l-112 0c-13.3 0-24-10.7-24-24s10.7-24 24-24z" />
        </svg>
        {expanded && (
          <span className="text-[11px] text-[var(--text-secondary)] whitespace-nowrap">
            <span className="text-[var(--text-muted)]">Ранее известен как </span>
            {names.map((n) => n.nickname).join(", ")}
          </span>
        )}
      </div>
    </div>
  );
}
