"use client";

import { useState } from "react";

export interface EditablePhoto {
  id: number;
  fileName: string;
  caption: string | null;
  visibility: "public" | "registered";
  nickname: string;
  createdAt: string;
}

export interface EditablePost {
  id: number;
  text: string;
  nickname: string;
  createdAt: string;
}

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function AdminContentEditor({
  photos,
  posts,
}: {
  photos: EditablePhoto[];
  posts: EditablePost[];
}) {
  const [photoItems, setPhotoItems] = useState(photos);
  const [postItems, setPostItems] = useState(posts);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function save(type: "photo" | "post", id: number, body: Record<string, unknown>) {
    setBusy(`${type}-${id}`);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/content", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id, ...body }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) throw new Error(data.error || "Не удалось сохранить");
      setMessage(data.message ?? "Сохранено");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сети");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
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

      <section className="mc-panel overflow-hidden">
        <div className="mc-head">Фото</div>
        {photoItems.length === 0 ? (
          <div className="p-6 text-sm text-[var(--text-muted)]">Фото пока нет.</div>
        ) : (
          <ul className="divide-y-2 divide-black/40">
            {photoItems.map((photo) => (
              <li key={photo.id} className="flex flex-wrap items-start gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold">{photo.nickname}</span>
                    <span className="font-mono text-[0.58rem] text-[var(--text-muted)]">
                      #{photo.id} · {formatWhen(photo.createdAt)}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <input
                      defaultValue={photo.caption ?? ""}
                      placeholder="Подпись"
                      className="mc-input min-w-[12rem] flex-1 py-1 text-xs"
                      onChange={(event) => {
                        const caption = event.target.value;
                        setPhotoItems((prev) =>
                          prev.map((item) =>
                            item.id === photo.id ? { ...item, caption } : item
                          )
                        );
                      }}
                    />
                    <select
                      value={photo.visibility}
                      className="mc-input w-auto py-1 text-xs"
                      onChange={(event) => {
                        const visibility =
                          event.target.value === "registered" ? "registered" : "public";
                        setPhotoItems((prev) =>
                          prev.map((item) =>
                            item.id === photo.id ? { ...item, visibility } : item
                          )
                        );
                      }}
                    >
                      <option value="public">Для всех</option>
                      <option value="registered">Только зарегистрированным</option>
                    </select>
                    <button
                      type="button"
                      disabled={busy === `photo-${photo.id}`}
                      onClick={() =>
                        void save("photo", photo.id, {
                          caption: photo.caption ?? "",
                          visibility: photo.visibility,
                        })
                      }
                      className="mc-btn px-2 py-1 text-[0.62rem]"
                    >
                      Сохранить
                    </button>
                    <a
                      href={`/uploads/photos/${photo.fileName}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="self-center text-[0.58rem] text-[var(--mc-green-light)] underline"
                    >
                      файл
                    </a>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mc-panel overflow-hidden">
        <div className="mc-head">Записи стены</div>
        {postItems.length === 0 ? (
          <div className="p-6 text-sm text-[var(--text-muted)]">Записей пока нет.</div>
        ) : (
          <ul className="divide-y-2 divide-black/40">
            {postItems.map((post) => (
              <li key={post.id} className="flex flex-wrap items-start gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold">{post.nickname}</span>
                    <span className="font-mono text-[0.58rem] text-[var(--text-muted)]">
                      #{post.id} · {formatWhen(post.createdAt)}
                    </span>
                  </div>
                  <textarea
                    defaultValue={post.text}
                    rows={2}
                    className="mc-input mt-2 w-full py-1 text-xs"
                    onChange={(event) => {
                      const text = event.target.value;
                      setPostItems((prev) =>
                        prev.map((item) => (item.id === post.id ? { ...item, text } : item))
                      );
                    }}
                  />
                </div>
                <button
                  type="button"
                  disabled={busy === `post-${post.id}`}
                  onClick={() => void save("post", post.id, { text: post.text })}
                  className="mc-btn px-2 py-1 text-[0.62rem]"
                >
                  Сохранить
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
