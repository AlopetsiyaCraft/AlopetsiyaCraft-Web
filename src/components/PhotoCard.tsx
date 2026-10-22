"use client";

import type { PhotoItem } from "@/lib/profile";

/** Карточка фото в сетке: изображение + автор/альбом/сезон/дата. */
export default function PhotoCard({
  photo,
  onOpen,
  showAuthor = false,
}: {
  photo: PhotoItem;
  onOpen: (photo: PhotoItem) => void;
  showAuthor?: boolean;
}) {
  return (
    <div
      className="mc-panel group cursor-pointer overflow-hidden transition-transform hover:-translate-y-0.5"
      onClick={() => onOpen(photo)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(photo);
        }
      }}
    >
      <div className="aspect-video overflow-hidden border-b-2 border-black bg-[var(--bg)]">
        <img
          src={photo.thumbUrl}
          alt={photo.caption || "Фото"}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
          onError={(e) => {
            // Старое фото без миниатюры на диске — показываем оригинал.
            e.currentTarget.onerror = null;
            e.currentTarget.src = photo.url;
          }}
        />
      </div>
      <div className="p-3">
        {photo.caption && (
          <p className="mb-1 truncate text-sm text-[var(--text)]">{photo.caption}</p>
        )}
        <div className="space-y-0.5 text-xs text-[var(--text-muted)]">
          {showAuthor && (
            <div className="truncate font-semibold text-[var(--mc-green-light)]">
              {photo.authorNickname}
            </div>
          )}
          <div className="flex flex-wrap gap-x-3">
            {photo.seasonNumber ? <span>Сезон {photo.seasonNumber}</span> : null}
            {photo.albumName ? <span>«{photo.albumName}»</span> : null}
          </div>
          <div className="flex justify-between">
            <span className="font-mono">{new Date(photo.createdAt).toLocaleDateString("ru-RU")}</span>
            {photo.commentCount > 0 && <span>💬 {photo.commentCount}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
