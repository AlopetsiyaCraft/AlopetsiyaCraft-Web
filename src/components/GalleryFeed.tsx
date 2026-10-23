"use client";

import { useCallback, useEffect, useState } from "react";
import PhotoLightbox from "./PhotoLightbox";
import type { SeasonOption } from "./PhotoUploader";
import type { PhotoItem } from "@/lib/profile";

/**
 * Галерея фото с фильтром по сезонам. Публичная: анонимы видят только public-фото,
 * комментарии скрыты. Загрузка доступна только со страницы своего профиля.
 * Сетка — чистые миниатюры без подписей; инфо — в полноэкранном просмотре.
 */
export default function GalleryFeed({
  seasons,
  isLoggedIn,
  viewerId,
  viewerNickname,
  fixedSeasonId,
  initialSeasonId,
  openPhotoId,
}: {
  seasons: SeasonOption[];
  isLoggedIn: boolean;
  viewerId: number | null;
  viewerNickname?: string | null;
  fixedSeasonId?: number | null;
  /** Сезон по умолчанию из ссылки (не фиксированный — фильтр можно менять). */
  initialSeasonId?: number | null;
  /** ID фото для открытия из ссылки (/gallery?photo=ID) — открывает лайтбокс на этом фото. */
  openPhotoId?: number | null;
}) {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [seasonFilter, setSeasonFilter] = useState<number | "all">(initialSeasonId ?? fixedSeasonId ?? "all");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [openedPhoto, setOpenedPhoto] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      // По ссылке на конкретное фото грузим все фото (без фильтра сезона), чтобы его найти.
      const season = openPhotoId != null ? "all" : fixedSeasonId ?? seasonFilter;
      const query = season === "all" ? "" : `?seasonId=${season}`;
      const res = await fetch(`/api/photos${query}`);
      if (!res.ok) throw new Error("Ошибка загрузки");
      const list = (await res.json()) as PhotoItem[];
      setPhotos(list);
      setError(null);
      // Автооткрываем лайтбокс по ссылке (только один раз на этот ID).
      if (openPhotoId != null && openedPhoto !== openPhotoId) {
        const idx = list.findIndex((p) => p.id === openPhotoId);
        if (idx >= 0) {
          setLightboxIndex(idx);
          setOpenedPhoto(openPhotoId);
        }
      }
    } catch {
      setError("Не удалось загрузить фото");
    } finally {
      setLoading(false);
    }
  }, [seasonFilter, fixedSeasonId, openPhotoId, openedPhoto]);

  useEffect(() => {
    // setState внутри refresh нельзя вызывать прямо в теле эффекта:
    // откладываем загрузку на следующий такт.
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const fixed = !!fixedSeasonId;

  return (
    <div className="flex flex-col gap-4">
      {!fixed && (
        <div className="mc-panel-flat no-scrollbar flex flex-wrap gap-1 overflow-x-auto p-1.5 sm:flex-nowrap">
          <SeasonTab
            active={seasonFilter === "all"}
            onClick={() => setSeasonFilter("all")}
            label="Все сезоны"
          />
          {seasons.map((s) => (
            <SeasonTab
              key={s.id}
              active={seasonFilter === s.id}
              onClick={() => setSeasonFilter(s.id)}
              label={`Сезон ${s.number}`}
            />
          ))}
        </div>
      )}

      {!isLoggedIn && (
        <p className="mc-inset px-3 py-2 text-xs text-[var(--text-muted)]">
          Вы смотрите галерею как гость: видны только фото «для всех», комментарии скрыты.
        </p>
      )}

      {loading ? (
        <div className="mc-panel-flat py-10 text-center text-sm text-[var(--text-muted)]">
          Загрузка…
        </div>
      ) : error ? (
        <div className="mc-panel-flat py-10 text-center text-sm text-[var(--mc-red)]">{error}</div>
      ) : photos.length === 0 ? (
        <div className="mc-panel-flat py-10 text-center text-sm text-[var(--text-muted)]">
          {fixed ? "В этом сезоне пока нет фото." : "Фото пока нет."}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setLightboxIndex(i)}
              className="group relative aspect-square cursor-pointer overflow-hidden border-2 border-black bg-[var(--bg)] shadow-[3px_3px_0_rgba(0,0,0,.55)] transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mc-green)]"
              title={p.originalName}
            >
              <img
                src={p.url}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
              />
              <span className="pointer-events-none absolute inset-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/80 via-black/0 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                <span className="truncate text-[0.65rem] font-semibold uppercase tracking-wider text-white">
                  {p.caption || p.albumName || "Скриншот"}
                </span>
                <svg className="h-4 w-4 shrink-0 text-[var(--mc-green-light)]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="square" d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
                </svg>
              </span>
            </button>
          ))}
        </div>
      )}

      {lightboxIndex != null && photos.length > 0 && (
        <PhotoLightbox
          photos={photos}
          initialIndex={lightboxIndex}
          isLoggedIn={isLoggedIn}
          viewerId={viewerId}
          viewerNickname={viewerNickname ?? null}
          onClose={() => setLightboxIndex(null)}
          onChanged={(updated) => {
            setPhotos((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
          }}
          onDeleted={() => refresh()}
        />
      )}
    </div>
  );
}

/** Пиксельный таб сезона. */
function SeasonTab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 cursor-pointer border-2 px-3 py-1.5 text-[0.72rem] font-bold uppercase tracking-[0.08em] transition-colors ${
        active
          ? "border-black bg-[var(--mc-green)] text-[#0f1a08]"
          : "border-transparent text-[var(--text-muted)] hover:border-black hover:bg-[var(--hover)] hover:text-[var(--text)]"
      }`}
    >
      {label}
    </button>
  );
}