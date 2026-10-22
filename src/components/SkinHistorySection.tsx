"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import PlayerHead from "@/components/mc/PlayerHead";

const SkinViewer = dynamic(() => import("@/components/SkinViewer"), {
  ssr: false,
  loading: () => (
    <div className="w-[110px] h-[110px] mc-inset flex items-center justify-center">
      <span className="text-[var(--text-muted)] text-xs">Загрузка...</span>
    </div>
  ),
});

export interface SkinHistoryItem {
  id: number;
  skinUrl: string;
  createdAt: string; // ISO
}

/**
 * История загруженных скинов: каждая миниатюра-голова показывает СВОЙ
 * файл (у записей уникальные URL), при наведении — тултип с датой загрузки,
 * и этот скин показывается в мини-предпросмотре справа. Зелёная рамка —
 * текущий скин, золотая — тот, на который сейчас наведены.
 */
export default function SkinHistorySection({
  skins,
  currentSkinUrl,
  model,
}: {
  skins: SkinHistoryItem[];
  currentSkinUrl?: string | null;
  model: "default" | "slim";
}) {
  const [hoveredUrl, setHoveredUrl] = useState<string | null>(null);
  const display = hoveredUrl ?? currentSkinUrl ?? null;

  return (
    <div className="mc-panel overflow-hidden mt-4">
      <div className="p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold mb-1">
              Скины{" "}
              <span className="text-[var(--text-muted)] text-sm font-normal">
                ({skins.length})
              </span>
            </h2>
            {skins.length === 0 ? (
              <p className="text-[var(--text-muted)] text-sm">Нет загруженных скинов</p>
            ) : (
              <p className="text-[var(--text-muted)] text-sm">
                Наведи на голову: появится дата загрузки, и эта версия скина
                покажется в предпросмотре справа.
              </p>
            )}
          </div>
          {display && (
            <div className="shrink-0">
              <SkinViewer
                skinUrl={display}
                model={model}
                width={110}
                height={110}
                showControls={false}
              />
            </div>
          )}
        </div>

        {skins.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {skins.map((skin) => {
              const isCurrent = skin.skinUrl === currentSkinUrl;
              const isHovered = hoveredUrl === skin.skinUrl;
              return (
                <div key={skin.id} className="relative group">
                  <div
                    onMouseEnter={() => setHoveredUrl(skin.skinUrl)}
                    onMouseLeave={() => setHoveredUrl(null)}
                    title={new Date(skin.createdAt).toLocaleString("ru-RU", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                    className={`w-12 h-12 relative overflow-hidden p-[2px] cursor-pointer transition-colors ${
                      isHovered
                        ? "bg-[var(--mc-gold)]"
                        : isCurrent
                        ? "bg-[var(--mc-green)]"
                        : "bg-black"
                    }`}
                  >
                    <PlayerHead skinUrl={skin.skinUrl} size={44} border={false} />
                  </div>
                  <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 whitespace-nowrap border-2 border-black bg-black text-white text-[11px] px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    {new Date(skin.createdAt).toLocaleString("ru-RU", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}