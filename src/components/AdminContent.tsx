"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface AdminPost {
  id: number;
  text: string;
  nickname: string;
  createdAt: string;
}

export interface AdminPhoto {
  id: number;
  fileName: string;
  caption: string | null;
  nickname: string;
  createdAt: string;
}

export interface AdminComment {
  id: number;
  text: string;
  targetId: number;
  nickname: string;
  createdAt: string;
}

type Tab = "wall" | "photo" | "post_comment" | "photo_comment";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "wall", label: "Стена" },
  { key: "photo", label: "Фото" },
  { key: "post_comment", label: "Комментарии стены" },
  { key: "photo_comment", label: "Комментарии фото" },
];

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function AdminContent({
  posts,
  photos,
  postComments,
  photoComments,
}: {
  posts: AdminPost[];
  photos: AdminPhoto[];
  postComments: AdminComment[];
  photoComments: AdminComment[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("wall");
  const [wall, setWall] = useState(posts);
  const [photoList, setPhotoList] = useState(photos);
  const [postCommentList, setPostCommentList] = useState(postComments);
  const [photoCommentList, setPhotoCommentList] = useState(photoComments);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function remove(type: Tab, id: number) {
    if (!window.confirm("Удалить безвозвратно?")) return;
    setBusy(`${type}-${id}`);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/content/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) throw new Error(data.error || "Не удалось удалить");
      if (type === "wall") setWall((prev) => prev.filter((item) => item.id !== id));
      if (type === "photo") setPhotoList((prev) => prev.filter((item) => item.id !== id));
      if (type === "post_comment") {
        setPostCommentList((prev) => prev.filter((item) => item.id !== id));
      }
      if (type === "photo_comment") {
        setPhotoCommentList((prev) => prev.filter((item) => item.id !== id));
      }
      setMessage(data.message ?? "Удалено");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(null);
    }
  }

  const counts: Record<Tab, number> = {
    wall: wall.length,
    photo: photoList.length,
    post_comment: postCommentList.length,
    photo_comment: photoCommentList.length,
  };

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p className="border-2 border-black bg-[rgba(214,69,69,0.14)] px-3 py-2 text-sm text-[var(--mc-red)]">
          {error}
        </p>
      )}
      {message && (
        <p className="border-2 border-black bg-[rgba(93,156,60,0.16)] px-3 py-2 text-sm text-[var(--mc-green-light)]">
          {message}
        </p>
      )}

      <div className="mc-panel-flat no-scrollbar flex flex-wrap gap-1 overflow-x-auto p-1.5 sm:flex-nowrap">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`shrink-0 border-2 px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.08em] transition-colors ${
              tab === item.key
                ? "border-black bg-[var(--mc-green)] text-[#0f1a08]"
                : "border-transparent text-[var(--text-muted)] hover:border-black hover:bg-[var(--hover)] hover:text-[var(--text)]"
            }`}
          >
            {item.label} ({counts[item.key]})
          </button>
        ))}
      </div>

      <section className="mc-panel overflow-hidden">
        {tab === "wall" && (
          <ul className="divide-y-2 divide-black/40">
            {wall.map((post) => (
              <li key={post.id} className="flex flex-wrap items-start gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold">{post.nickname}</span>
                    <span className="font-mono text-[0.58rem] text-[var(--text-muted)]">
                      #{post.id} · {formatWhen(post.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-line text-sm text-[var(--text-secondary)]">
                    {post.text || "—"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void remove("wall", post.id)}
                  disabled={busy === `wall-${post.id}`}
                  className="mc-btn px-2 py-1 text-[0.6rem] text-[var(--mc-red)]"
                >
                  Удалить
                </button>
              </li>
            ))}
            {wall.length === 0 && <Empty />}
          </ul>
        )}

        {tab === "photo" && (
          <ul className="divide-y-2 divide-black/40">
            {photoList.map((photo) => (
              <li key={photo.id} className="flex flex-wrap items-start gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold">{photo.nickname}</span>
                    <span className="font-mono text-[0.58rem] text-[var(--text-muted)]">
                      #{photo.id} · {formatWhen(photo.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    {photo.caption || "Без подписи"}
                  </p>
                  <a
                    href={`/uploads/photos/${photo.fileName}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block font-mono text-[0.6rem] text-[var(--mc-green-light)] underline"
                  >
                    {photo.fileName}
                  </a>
                </div>
                <button
                  type="button"
                  onClick={() => void remove("photo", photo.id)}
                  disabled={busy === `photo-${photo.id}`}
                  className="mc-btn px-2 py-1 text-[0.6rem] text-[var(--mc-red)]"
                >
                  Удалить
                </button>
              </li>
            ))}
            {photoList.length === 0 && <Empty />}
          </ul>
        )}

        {(tab === "post_comment" || tab === "photo_comment") && (
          <ul className="divide-y-2 divide-black/40">
            {(tab === "post_comment" ? postCommentList : photoCommentList).map(
              (comment) => (
                <li key={comment.id} className="flex flex-wrap items-start gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-semibold">{comment.nickname}</span>
                      <span className="font-mono text-[0.58rem] text-[var(--text-muted)]">
                        #{comment.id} · {tab === "post_comment" ? "запись" : "фото"}{" "}
                        {comment.targetId} · {formatWhen(comment.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-line text-sm text-[var(--text-secondary)]">
                      {comment.text}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void remove(tab, comment.id)}
                    disabled={busy === `${tab}-${comment.id}`}
                    className="mc-btn px-2 py-1 text-[0.6rem] text-[var(--mc-red)]"
                  >
                    Удалить
                  </button>
                </li>
              )
            )}
            {(tab === "post_comment" ? postCommentList : photoCommentList).length === 0 && (
              <Empty />
            )}
          </ul>
        )}
      </section>
    </div>
  );
}

function Empty() {
  return <li className="p-6 text-center text-sm text-[var(--text-muted)]">Пусто.</li>;
}
