"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import CommentTree from "./CommentTree";
import type { AlbumsListItem, PhotoCommentItem, PhotoItem } from "@/lib/profile";

function ruDate(ts: number): string {
  return new Date(ts).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

function visibilityLabel(v: PhotoItem["visibility"]): string {
  return v === "public" ? "Видно всем" : "Только зарегистрированным";
}

function Chevron({ className, dir }: { className?: string; dir: "left" | "right" }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      {dir === "left" ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      )}
    </svg>
  );
}

/**
 * Полноэкранный просмотр фото (VK-стиль): чуть затемнённый фон галереи, чистая картинка
 * по центру, стрелки и счётчик прямо на фото. Справа панель высотой ровно как фото:
 * мета сверху, комментарии скроллятся отдельно (без видимого скроллбара).
 * Клик вне фото — закрыть, ← → / клавиши — переключение.
 */
export default function PhotoLightbox({
  photos,
  initialIndex,
  isLoggedIn,
  viewerId,
  viewerNickname,
  onClose,
  onChanged,
  onDeleted,
}: {
  photos: PhotoItem[];
  initialIndex: number;
  isLoggedIn: boolean;
  viewerId: number | null;
  viewerNickname: string | null;
  onClose: () => void;
  onChanged?: (p: PhotoItem) => void;
  onDeleted?: (photoId: number) => void;
}) {
  const [index, setIndex] = useState(Math.min(Math.max(initialIndex, 0), photos.length - 1));
  const [comments, setComments] = useState<PhotoCommentItem[]>([]);
  const [albums, setAlbums] = useState<AlbumsListItem[]>([]);
  const [visibility, setVisibility] = useState<"public" | "registered">(photos[index]?.visibility ?? "public");
  const [albumId, setAlbumId] = useState<number | null>(photos[index]?.albumId ?? null);
  const [caption, setCaption] = useState(photos[index]?.caption ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [panelH, setPanelH] = useState<number | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const photo = photos[index];
  const isOwner = !!viewerId && photo?.userId === viewerId;

  const go = useCallback(
    (delta: number) => {
      setIndex((i) => {
        if (photos.length === 0) return i;
        return (i + delta + photos.length) % photos.length;
      });
    },
    [photos.length]
  );

  const refreshComments = useCallback(async () => {
    if (!isLoggedIn || !photo) return;
    const res = await fetch(`/api/photos/${photo.id}/comments`);
    if (res.ok) setComments((await res.json()) as PhotoCommentItem[]);
  }, [photo?.id, isLoggedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  // сбрасываем состояние на новом фото
  useEffect(() => {
    setComments([]);
    setCaption(photo?.caption ?? "");
    setVisibility(photo?.visibility ?? "public");
    setAlbumId(photo?.albumId ?? null);
    setMessage(null);
    if (isOwner && albums.length === 0) {
      fetch("/api/albums")
        .then((r) => r.json())
        .then((data: AlbumsListItem[]) => setAlbums(data))
        .catch(() => setAlbums([]));
    }
    refreshComments();
  }, [photo?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // клавиатура: ← → переключение, Esc — закрыть
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  // блокируем прокрутку страницы под лайтбоксом
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // панель справа — строго по высоте фото, но не выше экрана
  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const update = () => {
      const h = img.offsetHeight;
      if (h > 0) setPanelH(Math.min(h, window.innerHeight - 24));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(img);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [photo?.id]);

  async function addComment(text: string, parentId: number | null): Promise<boolean> {
    if (!photo) return false;
    try {
      const res = await fetch(`/api/photos/${photo.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, parentId }),
      });
      if (res.ok) {
        const item = (await res.json()) as PhotoCommentItem;
        setComments((c) => [...c, item]);
        return true;
      }
      const j = await res.json().catch(() => null);
      setMessage(j?.error ?? "Не удалось отправить комментарий");
      return false;
    } catch {
      return false;
    }
  }

  async function toggleLike(commentId: number) {
    if (!photo) return;
    try {
      const res = await fetch(`/api/photos/${photo.id}/comments/${commentId}/like`, { method: "POST" });
      if (res.ok) {
        const r = (await res.json()) as {
          liked: boolean;
          likeCount: number;
          likedByMe: boolean;
          likers: { nickname: string; skinUrl: string | null }[];
        };
        setComments((prev) =>
          prev.map((c) =>
            c.id === commentId
              ? { ...c, likedByMe: r.likedByMe, likeCount: r.likeCount, likers: r.likers }
              : c
          )
        );
      }
    } catch {
      // молча: лайк не критичен
    }
  }

  async function saveChanges() {
    if (!photo) return;
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
    if (!photo) return;
    if (!window.confirm("Удалить это фото?")) return;
    const res = await fetch(`/api/photos/${photo.id}`, { method: "DELETE" });
    if (res.ok) {
      onDeleted?.(photo.id);
      onClose();
    } else {
      setMessage("Не удалось удалить фото");
    }
  }

  if (!photo) return null;

  /** Клик по фото: левая половина — назад, правая — вперёд. */
  function handleImageClick(e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width / 2) go(-1);
    else go(1);
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center overflow-hidden cursor-default"
      onClick={onClose}
    >
      <div className="relative flex items-center shrink-0" onClick={(e) => e.stopPropagation()}>
        {/* ---- Фото: чистая картинка, стрелки и счётчик прямо на ней ---- */}
        <div className="relative group cursor-pointer" onClick={handleImageClick}>
          <img
            key={photo.id}
            ref={imgRef}
            src={photo.url}
            alt={photo.caption || "Фото"}
            className="max-h-screen max-w-[calc(100vw-412px)] object-contain select-none block"
            draggable={false}
          />

          {photos.length > 1 && (
            <>
              {/* Навигация-стрелки (появляются на фото при наведении) */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  go(-1);
                }}
                aria-label="Предыдущее фото"
                className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-60 hover:!opacity-90 transition-opacity cursor-pointer"
              >
                <Chevron dir="left" className="w-7 h-7" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  go(1);
                }}
                aria-label="Следующее фото"
                className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-60 hover:!opacity-90 transition-opacity cursor-pointer"
              >
                <Chevron dir="right" className="w-7 h-7" />
              </button>

              {/* Счётчик на полупрозрачном фоне прямо на фото */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-white/95 bg-black/55 rounded-full px-3 py-1 pointer-events-none">
                {index + 1} / {photos.length}
              </div>
            </>
          )}
        </div>

        {/* ---- Панель информации: по высоте фото, комментарии скроллятся отдельно ---- */}
        <aside
          className="w-[400px] max-w-[46vw] shrink-0 bg-[var(--card)] flex flex-col overflow-hidden"
          style={{ height: panelH ?? "auto" }}
        >
          <div className="px-5 py-4 border-b border-[var(--border)] shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <Link
                  href={`/profile/${encodeURIComponent(photo.authorNickname)}`}
                  className="text-[#7c3aed] hover:underline font-semibold"
                >
                  {photo.authorNickname}
                </Link>
                <div className="text-xs text-[var(--text-muted)]">
                  {photo.seasonNumber ? `Сезон ${photo.seasonNumber}` : "Без сезона"}
                  {photo.albumName ? ` · из альбома «${photo.albumName}»` : ""}
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-[var(--hover)] text-[var(--text-muted)]"
                title="Закрыть"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Основной блок (мета, подпись, правка) — не участвует в скролле комментариев */}
            <div className="shrink overflow-y-auto no-scrollbar min-h-0 px-5 pt-4 pb-4 space-y-4">
              <div className="text-sm space-y-1.5">
                <div className="flex gap-2">
                  <span className="text-[var(--text-muted)] shrink-0 w-32">Автор</span>
                  <Link
                    href={`/profile/${encodeURIComponent(photo.authorNickname)}`}
                    className="text-[#7c3aed] hover:underline"
                  >
                    {photo.authorNickname}
                  </Link>
                </div>
                <div className="flex gap-2">
                  <span className="text-[var(--text-muted)] shrink-0 w-32">Сезон</span>
                  <span>{photo.seasonNumber ? `Сезон ${photo.seasonNumber}` : "—"}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-[var(--text-muted)] shrink-0 w-32">Загружено</span>
                  <span>{ruDate(photo.createdAt)}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-[var(--text-muted)] shrink-0 w-32">Название</span>
                  <span className="break-words">{photo.originalName}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-[var(--text-muted)] shrink-0 w-32">Размер</span>
                  <span>{(photo.size / 1024).toFixed(0)} КБ</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-[var(--text-muted)] shrink-0 w-32">Доступ</span>
                  <span>{visibilityLabel(photo.visibility)}</span>
                </div>
              </div>

              {photo.caption && <p className="text-sm whitespace-pre-wrap break-words">{photo.caption}</p>}

              {/* Редактирование (владельцу) */}
              {isOwner && (
                <div className="bg-[var(--bg)] border border-[var(--border)] rounded-lg p-4 space-y-3">
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
                          {v === "public" ? "Всем" : "Только зарегистрированным"}
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
                  <div className="flex items-center gap-2 flex-wrap">
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
            </div>

            {/* Комментарии: отдельный скролл без видимого скроллбара */}
            <div className="border-t border-[var(--border)] pt-3 px-5 pb-4 min-h-0 flex-1 flex flex-col overflow-hidden">
              {isLoggedIn ? (
                <>
                  <h3 className="text-sm font-semibold mb-2 shrink-0">
                    Комментарии{" "}
                    <span className="text-[var(--text-muted)] font-normal">({comments.length})</span>
                  </h3>
                  <div className="flex-1 min-h-0">
                    <CommentTree
                      panel
                      comments={comments}
                      viewerNickname={viewerNickname}
                      onAddComment={addComment}
                      onToggleLike={(commentId) => toggleLike(commentId)}
                    />
                  </div>
                </>
              ) : (
                <h3 className="text-sm font-semibold text-[var(--text-muted)]">
                  Комментарии видны только зарегистрированным.
                </h3>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}