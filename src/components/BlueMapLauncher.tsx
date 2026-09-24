"use client";

import { useState } from "react";

/**
 * 3D-карта BlueMap с отложенным открытием.
 *
 * iframe НЕ находится в DOM, пока карту не открыли кликом по баннеру —
 * поэтому прокрутка страницы ничем не перехватывается и не «телепортирует»
 * вверх (лениво загружаемые/фокусирующиеся iframe умеют ронять скролл
 * родителя). Открытая карта работает как полноценный BlueMap;
 * «Свернуть карту» размонтирует iframe и возвращает баннер.
 */
export default function BlueMapLauncher({ src }: { src: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-[var(--border)] overflow-hidden">
      {open ? (
        <div className="relative bg-black">
          <iframe
            src={src}
            title="Карта мира BlueMap"
            className="w-full"
            style={{ height: "78vh" }}
            allowFullScreen
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute top-3 right-3 z-10 px-3 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
          >
            Свернуть карту
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full flex flex-col items-center justify-center gap-2 p-10 bg-[var(--card)] hover:bg-[var(--hover)] transition-colors cursor-pointer"
        >
          <span className="text-4xl" aria-hidden>
            🗺️
          </span>
          <span className="font-semibold">Открыть 3D-карту мира</span>
          <span className="text-sm text-[var(--text-muted)]">
            Полный обзор сервера как в BlueMap: вращение, зум, слои
          </span>
        </button>
      )}
    </div>
  );
}