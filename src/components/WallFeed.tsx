"use client";

import { useCallback, useEffect, useState } from "react";
import PhotoLightbox from "./PhotoLightbox";
import type { PhotoCommentItem, PhotoItem, PostCommentItem, PostItem } from "@/lib/profile";

function ruDate(ts: number): string {
  return new Date(ts).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

/** Записи со стены профиля: публикация (своей стены), лента, комментарии. */
export default function WallFeed({
  ownerUserId,
  isOwn,
  viewerId,
  viewerNickname,
  initialPosts,
}: {
  ownerUserId: number;
  isOwn: boolean;
  viewerId: number | null;
  viewerNickname: string | null;
  initialPosts: PostItem[];
}) {
  const [posts, setPosts] = useState<PostItem[]>(initialPosts);
  const [text, setText] = useState("");
  const [ownPhotos, setOwnPhotos] = useState<PhotoItem[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<number[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [commentsByPost, setCommentsByPost] = useState<Record<number, PostCommentItem[]>>({});
  const [commentText, setCommentText] = useState<Record<number, string>>({});
  const [lightbox, setLightbox] = useState<PhotoItem | null>(null);

  useEffect(() => {
    if (isOwn) {
      fetch("/api/photos?userId=" + ownerUserId)
        .then((r) => r.json())
        .then((data: PhotoItem[]) => setOwnPhotos(data))
        .catch(() => setOwnPhotos([]));
    }
  }, [isOwn, ownerUserId]);

  function togglePhotoSelection(id: number) {
    setSelectedPhotoIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 6 ? prev : [...prev, id]
    );
  }

  async function publish() {
    if (publishing) return;
    if (!text.trim() && selectedPhotoIds.length === 0) {
      setPublishError("Напишите текст или прикрепите фото");
      return;
    }
    setPublishing(true);
    setPublishError(null);
    try {
      const res = await fetch("/api/wall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), photoIds: selectedPhotoIds }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        setPublishError(j?.error ?? "Не удалось опубликовать");
        return;
      }
      if (j) setPosts((prev) => [j, ...prev]);
      setText("");
      setSelectedPhotoIds([]);
      setPickerOpen(false);
    } finally {
      setPublishing(false);
    }
  }

  async function deletePost(id: number) {
    if (!window.confirm("Удалить запись?")) return;
    const res = await fetch(`/api/wall/${id}`, { method: "DELETE" });
    if (res.ok) setPosts((prev) => prev.filter((p) => p.id !== id));
  }

  async function toggleComments(postId: number) {
    const next = new Set(expanded);
    if (next.has(postId)) {
      next.delete(postId);
      setExpanded(next);
      return;
    }
    next.add(postId);
    setExpanded(next);
    if (!commentsByPost[postId]) {
      const res = await fetch(`/api/wall/${postId}/comments`);
      if (res.ok) {
        const data = (await res.json()) as PostCommentItem[];
        setCommentsByPost((prev) => ({ ...prev, [postId]: data }));
      }
    }
  }

  async function addComment(postId: number) {
    const text = (commentText[postId] ?? "").trim();
    if (!text) return;
    const res = await fetch(`/api/wall/${postId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (res.ok) {
      const item = (await res.json()) as PostCommentItem;
      setCommentsByPost((prev) => ({ ...prev, [postId]: [...(prev[postId] ?? []), item] }));
      setCommentText((prev) => ({ ...prev, [postId]: "" }));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {isOwn && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={1000}
            placeholder="Что у вас нового?"
            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg p-3 text-sm min-h-[80px] resize-y focus:outline-none focus:border-[#7c3aed]"
          />

          {selectedPhotoIds.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {ownPhotos
                .filter((p) => selectedPhotoIds.includes(p.id))
                .map((p) => (
                  <div key={p.id} className="relative w-20 h-20 rounded-lg overflow-hidden border border-[var(--border)]">
                    <img src={p.url} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => togglePhotoSelection(p.id)}
                      className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/70 text-white text-xs flex items-center justify-center"
                    >
                      ✕
                    </button>
                  </div>
                ))}
            </div>
          )}

          <div className="flex items-center gap-2 mt-3">
            {isOwn && ownPhotos.length > 0 && (
              <button
                onClick={() => setPickerOpen(!pickerOpen)}
                className="px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] hover:border-[#7c3aed]/50"
              >
                📷 Прикрепить фото
              </button>
            )}
            <span className="text-xs text-[var(--text-muted)]">{selectedPhotoIds.length}/6</span>
            <button
              onClick={publish}
              disabled={publishing}
              className="ml-auto px-4 py-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm rounded-lg disabled:opacity-50"
            >
              {publishing ? "Публикуем…" : "Опубликовать"}
            </button>
          </div>
          {publishError && <p className="mt-2 text-sm text-red-400">{publishError}</p>}

          {pickerOpen && (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mt-3 max-h-56 overflow-auto custom-scrollbar">
              {ownPhotos.map((p) => (
                <div
                  key={p.id}
                  onClick={() => togglePhotoSelection(p.id)}
                  className={`aspect-square rounded-lg overflow-hidden cursor-pointer border-2 ${
                    selectedPhotoIds.includes(p.id) ? "border-[#7c3aed]" : "border-transparent"
                  }`}
                >
                  <img src={p.url} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {posts.length === 0 ? (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg py-10 text-center text-[var(--text-muted)] text-sm">
          {isOwn ? "На вашей стене пока пусто." : "На стене пока нет записей."}
        </div>
      ) : (
        posts.map((post) => (
          <div key={post.id} className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded shrink-0 overflow-hidden bg-[#7c3aed]/20 flex items-center justify-center text-sm font-bold">
                {post.authorSkinUrl ? (
                  <div
                    className="w-9 h-9"
                    style={{
                      backgroundImage: `url(${post.authorSkinUrl})`,
                      backgroundSize: "288px 288px",
                      backgroundPosition: "-36px -36px",
                      imageRendering: "pixelated",
                    }}
                  />
                ) : (
                  post.authorNickname[0]?.toUpperCase() ?? "?"
                )}
              </div>
              <div className="flex-1 min-w-0">
                <a href={`/profile/${encodeURIComponent(post.authorNickname)}`} className="font-medium text-sm hover:text-[#7c3aed]">
                  {post.authorNickname}
                </a>
                <div className="text-xs text-[var(--text-muted)]">{ruDate(post.createdAt)}</div>
              </div>
              {(isOwn && post.userId === ownerUserId) && (
                <button onClick={() => deletePost(post.id)} className="text-[var(--text-muted)] hover:text-red-400 text-xs" title="Удалить запись">
                  Удалить
                </button>
              )}
            </div>

            {post.text && <p className="text-sm whitespace-pre-wrap break-words">{post.text}</p>}

            {post.photos.length > 0 && (
              <div className={`grid gap-2 mt-3 ${post.photos.length === 1 ? "grid-cols-1" : post.photos.length === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}>
                {post.photos.map((p) => (
                  <div key={p.id} className="rounded-lg overflow-hidden cursor-pointer border border-[var(--border)]" onClick={() => setLightbox(p)}>
                    <img src={p.url} alt={p.caption || "Фото"} loading="lazy" className="w-full h-full object-cover max-h-72" />
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3 border-t border-[var(--border)] pt-2">
              <button
                onClick={() => toggleComments(post.id)}
                className="text-xs text-[var(--text-muted)] hover:text-[#7c3aed]"
              >
                💬 Комментарии ({commentsByPost[post.id]?.length ?? post.commentCount})
              </button>

              {expanded.has(post.id) && (
                <div className="mt-3 space-y-2">
                  {(commentsByPost[post.id] ?? []).length === 0 && (
                    <p className="text-xs text-[var(--text-muted)]">Комментариев пока нет</p>
                  )}
                  {(commentsByPost[post.id] ?? []).map((c) => (
                    <div key={c.id} className="bg-[var(--bubble)] rounded-lg px-3 py-2">
                      <div className="text-xs text-[var(--text-muted)]">
                        <a href={`/profile/${encodeURIComponent(c.authorNickname)}`} className="text-[#7c3aed] font-medium hover:underline">
                          {c.authorNickname}
                        </a>
                      </div>
                      <p className="text-sm mt-0.5 break-words">{c.text}</p>
                    </div>
                  ))}
                  {viewerNickname && (
                    <form
                      className="flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        addComment(post.id);
                      }}
                    >
                      <input
                        value={commentText[post.id] ?? ""}
                        onChange={(e) => setCommentText((prev) => ({ ...prev, [post.id]: e.target.value }))}
                        maxLength={500}
                        placeholder="Написать комментарий…"
                        className="flex-1 px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[#7c3aed]"
                      />
                      <button
                        type="submit"
                        disabled={!(commentText[post.id] ?? "").trim()}
                        className="px-3 py-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm rounded-lg disabled:opacity-50"
                      >
                        Отправить
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          </div>
        ))
      )}

      {lightbox && (
        <PhotoLightbox
          photo={lightbox}
          isLoggedIn={!!viewerId}
          viewerId={viewerId}
          onClose={() => setLightbox(null)}
          onChanged={(updated) => {
            setPosts((prev) =>
              prev.map((p) => ({ ...p, photos: p.photos.map((ph) => (ph.id === updated.id ? updated : ph)) }))
            );
            setLightbox(updated);
          }}
          onDeleted={() => {}}
        />
      )}
    </div>
  );
}