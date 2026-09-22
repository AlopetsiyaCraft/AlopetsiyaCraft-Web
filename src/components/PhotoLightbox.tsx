"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { AlbumsListItem, PhotoCommentItem, PhotoItem } from "@/lib/profile";

function ruDate(ts: number): string {
  return new Date(ts).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

function visibilityLabel(v: PhotoItem["visibility"]): string {
  return v === "public" ? "Видно всем" : "Только зарегистрированным";
}

/** Лайтбокс: фото крупно + мета + комментарии (залогиненным) + правка (владельцу). */
export default function PhotoLightbox({
  photo,
  isLoggedIn,
  viewerId,
  onClose,
  onChanged,
  onDeleted,
}: {
  photo: PhotoItem;
  isLoggedIn: boolean;
  viewerId: number | null;
  onClose: () => void;
  onChanged?: (p: PhotoItem) => void;
  onDeleted?: () => void;
}) {
  const [comments, setComments] = useState<PhotoCommentItem[]>([]);
  const [commentText, setCommentText] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [albums, setAlbums] = useState<AlbumsListItem[]>([]);
  const [visibility, setVisibility] = useState<"public" | "registered">(photo.visibility);
  const [albumId, setAlbumId] = useState<number | null>(photo.albumId);
  const [caption, setCaption] = useState(photo.caption ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const isOwner = !!viewerId && photo.userId === viewerId;

  const refreshComments = useCallback(async () => {
    if (!isLoggedIn) {
      setComments([]);
      return;
    }
    const res = await fetch(`/api/photos/${photo.id}/comments`);
    if (res.ok) setComments((await res.json()) as PhotoCommentItem[]);
  }, [photo.id, isLoggedIn]);

  useEffect(() => {
    refreshComments();
  }, [refreshComments]);

  useEffect(() => {
    if (isOwner && albums.length === 0) {
      fetch("/api/albums")
        .then((r) => r.json())
        .then((data: AlbumsListItem[]) => setAlbums(data))
        .catch(() => setAlbums([]));
    }
    setVisibility(photo.visibility);
    setAlbumId(photo.albumId);
    setCaption(photo.caption ?? "");
  }, [photo, isOwner]); // eslint-disable-line react-hooks/exhaustive-deps

  async function addComment() {
    const text = commentText.trim();
    if (!text || sendingComment) return;
    setSendingComment(true);
    try {
      const res = await fetch(`/api/photos/${photo.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        const item = (await res.json()) as PhotoCommentItem;
        setComments((c) => [...c, item]);
        setCommentText("");
      } else {
        const j = await res.json().catch(() => null);
        setMessage(j?.error ?? "Не удалось отправить комментарий");
      }
    } finally {
      setSendingComment(false);
    }
  }

  async function saveChanges() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/photos/${photo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility, albumId, caption }),
      });
      if (res.ok) {
        const updated: PhotoItem = { ...photo, visibility, albumId, caption: caption.trim() || null };
        setMessage("Сохранено");
        onChanged?.(updated);
      } else {
        const j = await res.json().catch(() => null);
        setMessage(j?.error ?? "Ошибка сохранения");
      }
    } finally {
      setSaving(false);
    }
  }

  async function deletePhoto() {
    if (!window.confirm("Удалить это фото?")) return;
    const res = await fetch(`/api/photos/${photo.id}`, { method: "DELETE" });
    if (res.ok) {
      onDeleted?.();
      onClose();
    } else {
      setMessage("Не удалось удалить фото");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--card)] border border-[var(--border)] rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <div className="text-sm text-[var(--text-secondary)]">
            <Link href={`/profile/${encodeURIComponent(photo.authorNickname)}`} className="text-[#7c3aed] hover:underline font-medium">
              {photo.authorNickname}
            </Link>
            {photo.seasonNumber ? <span> · Сезон {photo.seasonNumber}</span> : null}
            {photo.albumName ? <span> · из альбома «{photo.albumName}»</span> : null}
            <span> · {ruDate(photo.createdAt)}</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--hover)] text-[var(--text-muted)]" title="Закрыть">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-auto flex-1 custom-scrollbar">
          <div className="p-4">
            <img src={photo.url} alt={photo.caption || "Фото"} className="max-h-[50vh] mx-auto rounded-lg" />

            <div className="mt-3 text-xs text-[var(--text-muted)] flex flex-wrap gap-x-4 gap-y-1">
              <span>{visibilityLabel(photo.visibility)}</span>
              <span>{photo.originalName}</span>
              <span>{(photo.size / 1024).toFixed(0)} КБ</span>
            </div>
            {photo.caption && <p className="mt-2 text-sm">{photo.caption}</p>}

            {isOwner && (
              <div className="mt-4 bg-[var(--bg)] border border-[var(--border)] rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-semibold">Редактирование</h3>
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">Кто видит фото</label>
                  <div className="flex gap-2">
                    {(["public", "registered"] as const).map((v) => (
                      <button
                        key={v}
                        onClick={() => setVisibility(v)}
                        className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                          visibility === v
                            ? "bg-[#7c3aed] border-[#7c3aed] text-white"
                            : "bg-[var(--card)] border-[var(--border)] text-[var(--text)] hover:border-[#7c3aed]/50"
                        }`}
                      >
                        {v === "public" ? "Всем пользователям" : "Только зарегистрированным"}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">Альбом</label>
                  <select
                    value={albumId ?? ""}
                    onChange={(e) => setAlbumId(e.target.value ? parseInt(e.target.value, 10) : null)}
                    className="w-full px-3 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg text-sm"
                  >
                    <option value="">Без альбома</option>
                    {albums.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">Подпись</label>
                  <input
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    maxLength={200}
                    className="w-full px-3 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg text-sm"
                    placeholder="Подпись к фото"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={saveChanges}
                    disabled={saving}
                    className="px-4 py-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm rounded-lg disabled:opacity-50"
                  >
                    {saving ? "Сохраняем…" : "Сохранить"}
                  </button>
                  <button
                    onClick={deletePhoto}
                    className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm rounded-lg"
                  >
                    Удалить фото
                  </button>
                  {message && <span className="text-sm text-[var(--text-secondary)]">{message}</span>}
                </div>
              </div>
            )}

            {isLoggedIn ? (
              <div className="mt-4 border-t border-[var(--border)] pt-4">
                <h3 className="text-sm font-semibold mb-2">
                  Комментарии <span className="text-[var(--text-muted)] font-normal">({comments.length})</span>
                </h3>
                <div className="space-y-3 mb-3">
                  {comments.length === 0 ? (
                    <p className="text-[var(--text-muted)] text-sm">Комментариев пока нет</p>
                  ) : (
                    comments.map((c) => (
                      <div key={c.id} className="bg-[var(--bubble)] rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2 text-xs">
                          <Link
                            href="#"
                            className="text-[#7c3aed] font-medium"
                            onClick={(e) => {
                              e.preventDefault();
                              window.location.href = `/profile/${encodeURIComponent(c.authorNickname)}`;
                            }}
                          >
                            {c.authorNickname}
                          </Link>
                          <span className="text-[var(--text-muted)]">{ruDate(c.createdAt)}</span>
                        </div>
                        <p className="text-sm mt-1 break-words">{c.text}</p>
                      </div>
                    ))
                  )}
                </div>
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    addComment();
                  }}
                >
                  <input
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    maxLength={500}
                    placeholder="Написать комментарий…"
                    className="flex-1 px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[#7c3aed]"
                  />
                  <button
                    type="submit"
                    disabled={!commentText.trim() || sendingComment}
                    className="px-4 py-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm rounded-lg disabled:opacity-50"
                  >
                    Отправить
                  </button>
                </form>
              </div>
            ) : (
              <p className="mt-4 text-[var(--text-muted)] text-sm">Комментарии видны только зарегистрированным.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}