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
      className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden cursor-pointer group"
      onClick={() => onOpen(photo)}
    >
      <div className="aspect-video bg-[var(--bg)] overflow-hidden">
        <img
          src={photo.thumbUrl}
          alt={photo.caption || "Фото"}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          onError={(e) => {
            // Старое фото без миниатюры на диске — показываем оригинал.
            e.currentTarget.onerror = null;
            e.currentTarget.src = photo.url;
          }}
        />
      </div>
      <div className="p-3">
        {photo.caption && <p className="text-sm mb-1 truncate">{photo.caption}</p>}
        <div className="text-xs text-[var(--text-muted)] space-y-0.5">
          {showAuthor && (
            <div>
              <span className="text-[var(--text-secondary)]">{photo.authorNickname}</span>
            </div>
          )}
          <div className="flex flex-wrap gap-x-3">
            {photo.seasonNumber ? <span>Сезон {photo.seasonNumber}</span> : null}
            {photo.albumName ? <span>«{photo.albumName}»</span> : null}
          </div>
          <div className="flex justify-between">
            <span>{new Date(photo.createdAt).toLocaleDateString("ru-RU")}</span>
            {photo.commentCount > 0 && <span>💬 {photo.commentCount}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}