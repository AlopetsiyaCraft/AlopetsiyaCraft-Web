"use client";

import { useCallback, useEffect, useState } from "react";
import PhotoCard from "./PhotoCard";
import PhotoLightbox from "./PhotoLightbox";
import PhotoUploader, { type SeasonOption } from "./PhotoUploader";
import type { PhotoItem } from "@/lib/profile";

/** Галерея фото с фильтром по сезонам. Публичная: анонимы видят только public-фото, без комментариев. */
export default function GalleryFeed({
  seasons,
  isLoggedIn,
  viewerId,
  fixedSeasonId,
}: {
  seasons: SeasonOption[];
  isLoggedIn: boolean;
  viewerId: number | null;
  fixedSeasonId?: number | null;
}) {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [seasonFilter, setSeasonFilter] = useState<number | "all">(fixedSeasonId ?? "all");
  const [lightbox, setLightbox] = useState<PhotoItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const query = fixedSeasonId
        ? `?seasonId=${fixedSeasonId}`
        : seasonFilter === "all"
          ? ""
          : `?seasonId=${seasonFilter}`;
      const res = await fetch(`/api/photos${query}`);
      if (!res.ok) throw new Error("Ошибка загрузки");
      setPhotos((await res.json()) as PhotoItem[]);
      setError(null);
    } catch {
      setError("Не удалось загрузить фото");
    } finally {
      setLoading(false);
    }
  }, [seasonFilter, fixedSeasonId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const fixed = !!fixedSeasonId;

  return (
    <div className="flex flex-col gap-4">
      {isLoggedIn && <PhotoUploader seasons={seasons} fixedSeasonId={fixedSeasonId ?? null} onUploaded={() => refresh()} />}

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
          {fixed ? "В этом сезоне пока нет фото." : "Фото пока нет. Загрузите первое!"}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {photos.map((p) => (
            <PhotoCard key={p.id} photo={p} showAuthor onOpen={setLightbox} />
          ))}
        </div>
      )}

      {lightbox && (
        <PhotoLightbox
          photo={lightbox}
          isLoggedIn={isLoggedIn}
          viewerId={viewerId}
          onClose={() => setLightbox(null)}
          onChanged={(updated) => {
            setPhotos((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
            setLightbox(updated);
          }}
          onDeleted={() => refresh()}
        />
      )}
    </div>
  );
}