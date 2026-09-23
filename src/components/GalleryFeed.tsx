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
    refresh();
  }, [refresh]);

  const fixed = !!fixedSeasonId;

  return (
    <div className="flex flex-col gap-4">
      {!fixed && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSeasonFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
              seasonFilter === "all"
                ? "bg-[#7c3aed] border-[#7c3aed] text-white"
                : "bg-[var(--card)] border-[var(--border)] text-[var(--text)] hover:border-[#7c3aed]/50"
            }`}
          >
            Все сезоны
          </button>
          {seasons.map((s) => (
            <button
              key={s.id}
              onClick={() => setSeasonFilter(s.id)}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                seasonFilter === s.id
                  ? "bg-[#7c3aed] border-[#7c3aed] text-white"
                  : "bg-[var(--card)] border-[var(--border)] text-[var(--text)] hover:border-[#7c3aed]/50"
              }`}
            >
              Сезон {s.number}
            </button>
          ))}
        </div>
      )}

      {!isLoggedIn && (
        <p className="text-xs text-[var(--text-muted)]">
          Вы смотрите галерею как гость: видны только фото «для всех», комментарии скрыты.
        </p>
      )}

      {loading ? (
        <div className="text-[var(--text-muted)] text-sm py-8 text-center">Загрузка…</div>
      ) : error ? (
        <div className="text-red-400 text-sm py-8 text-center">{error}</div>
      ) : photos.length === 0 ? (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg py-10 text-center text-[var(--text-muted)] text-sm">
          {fixed ? "В этом сезоне пока нет фото." : "Фото пока нет."}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {photos.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setLightboxIndex(i)}
              className="group aspect-square overflow-hidden rounded-md bg-[var(--bg)] cursor-pointer relative focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/60"
              title={p.originalName}
            >
              <img
                src={p.url}
                alt=""
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
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