"use client";

import { useCallback, useEffect, useState } from "react";
import CommentTree from "./CommentTree";
import PhotoLightbox from "./PhotoLightbox";
import type { PhotoItem, PostCommentItem, PostItem } from "@/lib/profile";

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
  const [lightbox, setLightbox] = useState<{ photos: PhotoItem[]; index: number } | null>(null);

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

  async function addComment(postId: number, text: string, parentId: number | null): Promise<boolean> {
    const t = text.trim();
    if (!t) return false;
    const res = await fetch(`/api/wall/${postId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: t, parentId }),
    });
    if (res.ok) {
      const item = (await res.json()) as PostCommentItem;
      setCommentsByPost((prev) => ({ ...prev, [postId]: [...(prev[postId] ?? []), item] }));
      return true;
    }
    return false;
  }

  async function toggleLike(postId: number, commentId: number) {
    const res = await fetch(`/api/wall/${postId}/comments/${commentId}/like`, { method: "POST" });
    if (!res.ok) return;
    const r = (await res.json()) as {
      liked: boolean;
      likeCount: number;
      likedByMe: boolean;
      likers: { nickname: string; skinUrl: string | null }[];
    };
    setCommentsByPost((prev) => ({
      ...prev,
      [postId]: (prev[postId] ?? []).map((c) =>
        c.id === commentId ? { ...c, likedByMe: r.likedByMe, likeCount: r.likeCount, likers: r.likers } : c
      ),
    }));
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
                {post.photos.map((p, i) => (
                  <div key={p.id} className="rounded-lg overflow-hidden cursor-pointer border border-[var(--border)]" onClick={() => setLightbox({ photos: post.photos, index: i })}>
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
                <div className="mt-3">
                  <CommentTree
                    comments={commentsByPost[post.id] ?? []}
                    viewerNickname={viewerNickname}
                    onAddComment={(text, parentId) => addComment(post.id, text, parentId)}
                    onToggleLike={(commentId) => toggleLike(post.id, commentId)}
                    loginHint="Комментарии видны только зарегистрированным."
                  />
                </div>
              )}
            </div>
          </div>
        ))
      )}

      {lightbox && (
        <PhotoLightbox
          photos={lightbox.photos}
          initialIndex={lightbox.index}
          isLoggedIn={!!viewerId}
          viewerId={viewerId}
          viewerNickname={viewerNickname}
          onClose={() => setLightbox(null)}
          onChanged={(updated) => {
            setPosts((prev) =>
              prev.map((p) => ({ ...p, photos: p.photos.map((ph) => (ph.id === updated.id ? updated : ph)) }))
            );
            setLightbox((lb) =>
              lb ? { ...lb, photos: lb.photos.map((ph) => (ph.id === updated.id ? updated : ph)) } : lb
            );
          }}
          onDeleted={(photoId) => {
            setPosts((prev) => prev.map((p) => ({ ...p, photos: p.photos.filter((ph) => ph.id !== photoId) })));
          }}
        />
      )}
    </div>
  );
}