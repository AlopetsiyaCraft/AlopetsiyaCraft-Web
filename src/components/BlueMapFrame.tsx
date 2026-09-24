"use client";

import { useState } from "react";

/**
 * iframe с 3D-картой BlueMap + «click-to-activate».
 *
 * Пока карта не активирована, iframe имеет pointer-events: none — колесо мыши
 * и тач-жесты над картой скроллят страницу, а не застревают в 3D-сцене.
 * Первый клик по кнопке активирует карту: дальше всё работает как в
 * оригинальном BlueMap. Кнопка в углу возвращает режим прокрутки страницы.
 */
export default function BlueMapFrame({ src }: { src: string }) {
  const [active, setActive] = useState(false);

  return (
    <div className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-black">
      <iframe
        src={src}
        title="Карта мира BlueMap"
        className="w-full"
        style={{ height: "70vh", pointerEvents: active ? "auto" : "none" }}
        loading="lazy"
        allowFullScreen
      />

      {!active && (
        <button
          type="button"
          onClick={() => setActive(true)}
          className="absolute inset-0 flex items-center justify-center bg-black/25 hover:bg-black/40 transition-colors cursor-pointer"
          aria-label="Активировать карту"
        >
          <div className="px-6 py-4 rounded-xl bg-[var(--card)] border border-[var(--border)] text-center shadow-lg pointer-events-none">
            <div className="font-semibold">Карта мира</div>
            <div className="text-sm text-[var(--text-muted)] mt-1">
              Нажмите, чтобы управлять картой
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-1 opacity-70">
              пока не нажали — колёсико прокручивает страницу
            </div>
          </div>
        </button>
      )}

      {active && (
        <button
          type="button"
          onClick={() => setActive(false)}
          className="absolute top-3 right-3 z-10 px-3 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
        >
          Отключить управление
        </button>
      )}
    </div>
  );
}