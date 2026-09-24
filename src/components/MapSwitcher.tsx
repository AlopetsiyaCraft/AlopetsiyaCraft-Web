"use client";

import { useState } from "react";

export interface MapInfo {
  id: string;
  label: string;
  url: string;
}

/**
 * Переключатель карт на главной: вкладки (BlueMap / JourneyMap) и iframe
 * активной карты. iframe выбранной карты монтируется с key — при смене
 * вкладки старый фрейм полностью выгружается. Стили вкладок повторяют
 * акцент сайта (#7c3aed).
 */
export default function MapSwitcher({ maps }: { maps: MapInfo[] }) {
  const [activeId, setActiveId] = useState(maps[0].id);
  const active = maps.find((m) => m.id === activeId) ?? maps[0];

  return (
    <div>
      <div className="flex gap-2 mb-3" role="tablist" aria-label="Карты мира">
        {maps.map((m) => {
          const isActive = m.id === active.id;
          return (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveId(m.id)}
              className={
                "px-4 py-2 rounded-lg text-sm transition-colors border cursor-pointer " +
                (isActive
                  ? "bg-[#7c3aed] text-white border-[#7c3aed]"
                  : "bg-[var(--card)] text-[var(--text-secondary)] border-[var(--border)] hover:text-[var(--text)] hover:bg-[var(--hover)]")
              }
            >
              {m.label}
            </button>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-black">
        <iframe
          key={active.id}
          src={active.url}
          title={`Карта мира — ${active.label}`}
          className="w-full"
          style={{ height: "70vh" }}
          scrolling="no"
          tabIndex={-1}
          allowFullScreen
        />
      </div>
    </div>
  );
}