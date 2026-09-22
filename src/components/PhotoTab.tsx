"use client";

import { useCallback, useEffect, useState } from "react";
import PhotoCard from "./PhotoCard";
import PhotoLightbox from "./PhotoLightbox";
import PhotoUploader from "./PhotoUploader";
import type { SeasonOption } from "./PhotoUploader";
import type { AlbumsListItem, PhotoItem } from "@/lib/profile";

/** Вкладка «Фото» профиля: сетка фото, альбомы, загрузка (владельцу). */
export default function PhotoTab({
  isOwn,
  ownerUserId,
  ownerNickname,
  viewerId,
  seasons,
}: {
  isOwn: boolean;
  ownerUserId: number;
  ownerNickname: string;
  viewerId: number | null;
  seasons: SeasonOption[];
}) {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [albums, setAlbums] = useState<AlbumsListItem[]>([]);
  const [albumFilter, setAlbumFilter] = useState<number | "none" | "all">("all");
  const [lightbox, setLightbox] = useState<PhotoItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newAlbumName, setNewAlbumName] = useState("");
  const [albumMsg, setAlbumMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [p, a] = await Promise.all([
        fetch(`/api/photos?userId=${ownerUserId}`).then((r) => r.json()),
        fetch(`/api/albums?userId=${ownerUserId}`).then((r) => r.json()),
      ]);
      setPhotos(p as PhotoItem[]);
      setAlbums(a as AlbumsListItem[]);
      setError(null);
    } catch {
      setError("Не удалось загрузить фото");
    } finally {
      setLoading(false);
    }
  }, [ownerUserId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function createAlbum() {
    const name = newAlbumName.trim();
    if (!name) return;
    setAlbumMsg(null);
    const res = await fetch("/api/albums", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const j = await res.json().catch(() => null);
    if (res.ok) {
      setNewAlbumName("");
      setAlbumMsg("Альбом создан");
      refresh();
    } else {
      setAlbumMsg(j?.error ?? "Ошибка");
    }
  }

  async function renameAlbum(album: AlbumsListItem) {
    const name = window.prompt("Новое название альбома:", album.name);
    if (!name || name.trim() === album.name) return;
    const res = await fetch(`/api/albums/${album.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    if (res.ok) refresh();
  }

  async function deleteAlbum(album: AlbumsListItem) {
    if (!window.confirm(`Удалить альбом «${album.name}»? Фото сохранятся, но без альбома.`)) return;
    const res = await fetch(`/api/albums/${album.id}`, { method: "DELETE" });
    if (res.ok) {
      setAlbumFilter("all");
      refresh();
    }
  }

  const filtered =
    albumFilter === "all"
      ? photos
      : albumFilter === "none"
        ? photos.filter((p) => p.albumId === null)
        : photos.filter((p) => p.albumId === albumFilter);

  const chips: Array<{ key: number | "none" | "all"; label: string }> = [
    { key: "all", label: `Все фото (${photos.length})` },
    ...photos.some((p) => p.albumId === null)
      ? [{ key: "none" as const, label: "Без альбома" }]
      : [],
    ...albums.map((a) => ({
      key: a.id,
      label: `${a.name} (${a.photoCount})`,
    })),
  ];

  return (
    <div className="flex flex-col gap-4">
      {isOwn && (
        <PhotoUploader seasons={seasons} onUploaded={() => refresh()} />
      )}

      {isOwn && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-3">Альбомы</h3>
          {albums.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {albums.map((a) => (
                <div key={a.id} className="flex items-center gap-1 bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm">
                  <span>{a.name}</span>
                  <button onClick={() => renameAlbum(a)} className="text-[var(--text-muted)] hover:text-[var(--text)]" title="Переименовать">✎</button>
                  <button onClick={() => deleteAlbum(a)} className="text-[var(--text-muted)] hover:text-red-400" title="Удалить">✕</button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={newAlbumName}
              onChange={(e) => setNewAlbumName(e.target.value)}
              maxLength={60}
              placeholder="Название нового альбома"
              className="flex-1 px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[#7c3aed]"
            />
            <button
              onClick={createAlbum}
              disabled={!newAlbumName.trim()}
              className="px-4 py-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm rounded-lg disabled:opacity-50"
            >
              Создать
            </button>
          </div>
          {albumMsg && <p className="mt-2 text-sm text-[var(--text-secondary)]">{albumMsg}</p>}
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            Альбом не обязателен — главное, чтобы фото было привязано к сезону (тогда оно появится в галерее).
          </p>
        </div>
      )}

      {!isOwn && (
        <div>
          <h1 className="text-2xl font-bold">
            Фото: <span className="text-[#7c3aed]">{ownerNickname}</span>
            <span className="text-[var(--text-muted)] text-sm font-normal ml-2">({photos.length})</span>
          </h1>
        </div>
      )}

      {chips.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <button
              key={String(c.key)}
              onClick={() => setAlbumFilter(c.key)}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                albumFilter === c.key
                  ? "bg-[#7c3aed] border-[#7c3aed] text-white"
                  : "bg-[var(--card)] border-[var(--border)] text-[var(--text)] hover:border-[#7c3aed]/50"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="text-[var(--text-muted)] text-sm py-8 text-center">Загрузка…</div>
      ) : error ? (
        <div className="text-red-400 text-sm py-8 text-center">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg py-10 text-center text-[var(--text-muted)] text-sm">
          {isOwn ? "Пока нет фото. Загрузи первое — не забудь выбрать сезон!" : "У этого игрока пока нет фото."}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <PhotoCard key={p.id} photo={p} onOpen={setLightbox} />
          ))}
        </div>
      )}

      {lightbox && (
        <PhotoLightbox
          photo={lightbox}
          isLoggedIn={!!viewerId}
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