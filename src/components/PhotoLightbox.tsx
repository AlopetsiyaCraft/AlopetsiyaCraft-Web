"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import CommentTree from "./CommentTree";
import type { PhotoCommentItem, PhotoItem } from "@/lib/profile";

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
 * Под фото — нижний блок с сезоном и кнопкой «Поделиться» (копирует ссылку на фото).
 * Клик вне фото — закрыть, ← → / клавиши — переключение.
 */
export default function PhotoLightbox({
  photos,
  initialIndex,
  isLoggedIn,
  viewerNickname,
  onClose,
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
  const [message, setMessage] = useState<string | null>(null);
  const [panelH, setPanelH] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const colRef = useRef<HTMLDivElement | null>(null);

  const photo = photos[index];

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
    setMessage(null);
    setCopied(false);
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

  // панель справа — строго по высоте левой колонки (фото + нижний блок), но не выше экрана
  useEffect(() => {
    const col = colRef.current;
    if (!col) return;
    const update = () => {
      const h = col.offsetHeight;
      if (h > 0) setPanelH(Math.min(h, window.innerHeight - 24));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(col);
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

  /** «Поделиться»: копирует ссылку на просмотр этого фото в галерее. */
  async function share() {
    if (!photo) return;
    const url = `${window.location.origin}/gallery?photo=${photo.id}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      setMessage(null);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setMessage("Не удалось скопировать ссылку");
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
      <div className="relative flex shrink-0" onClick={(e) => e.stopPropagation()}>
        {/* ---- Левая колонка: фото + нижний блок под ним ---- */}
        <div ref={colRef} className="flex flex-col">
          {/* Фото: чистая картинка, стрелки и счётчик прямо на ней */}
          <div className="relative group cursor-pointer" onClick={handleImageClick}>
            <img
              key={photo.id}
              src={photo.url}
              alt={photo.caption || "Фото"}
              className="max-h-[calc(100vh-64px)] max-w-[calc(100vw-412px)] object-contain select-none block"
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

          {/* ---- Нижний блок под фото (VK-стиль): сезон слева снизу, «Поделиться» справа ---- */}
          <div className="h-14 shrink-0 bg-[var(--card)] border-t border-[var(--border)] flex items-end justify-between gap-3 px-5 pb-2.5">
            <span className="text-sm text-[var(--text-secondary)]">
              {photo.seasonNumber ? (
                <Link
                  href={`/gallery?season=${photo.seasonId}`}
                  className="hover:text-[#7c3aed] transition-colors"
                >
                  Фотографии сезона ({photo.seasonNumber})
                </Link>
              ) : (
                "Фотографии"
              )}
            </span>
            <button
              onClick={share}
              title="Скопировать ссылку на фото"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[#7c3aed] hover:bg-[var(--hover)] transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7M12 8v12" />
              </svg>
              {copied ? "Ссылка скопирована" : "Поделиться"}
            </button>
          </div>
        </div>

        {/* ---- Панель информации: высота = фото + нижний блок, комментарии скроллятся отдельно ---- */}
        <aside
          className="w-[400px] max-w-[46vw] shrink-0 bg-[var(--card)] border-l border-[var(--border)] flex flex-col overflow-hidden"
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
            {/* Основной блок (мета, подпись) — не участвует в скролле комментариев */}
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
            </div>

            {/* Комментарии: линия сверху, поле ввода наверху, список скроллится без видимого скроллбара */}
            <div className="border-t border-[var(--border)] min-h-0 flex-1 flex flex-col overflow-hidden">
              {message && <p className="text-xs text-red-400 shrink-0 px-5 pt-2">{message}</p>}
              {isLoggedIn ? (
                <CommentTree
                  panel
                  listTitle={`Комментарии (${comments.length})`}
                  comments={comments}
                  viewerNickname={viewerNickname}
                  onAddComment={addComment}
                  onToggleLike={(commentId) => toggleLike(commentId)}
                />
              ) : (
                <h3 className="text-sm font-semibold text-[var(--text-muted)] px-5 pt-3">
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