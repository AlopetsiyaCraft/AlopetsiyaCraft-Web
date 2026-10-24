"use client";

import { useState } from "react";

export default function BroadcastForm({ recipients }: { recipients: number }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [toChat, setToChat] = useState(true);
  const [toDiscord, setToDiscord] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, link, chat: toChat, discord: toDiscord }),
      });
      const data = (await res.json()) as { error?: string; message?: string; recipients?: number };
      if (!res.ok) throw new Error(data.error || "Не удалось отправить");
      setMessage(`${data.message ?? "Отправлено"} · получателей: ${data.recipients ?? recipients}`);
      setTitle("");
      setBody("");
      setLink("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сети");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mc-panel flex flex-col gap-3 p-4">
      <label className="flex flex-col gap-1 text-[0.58rem] uppercase tracking-[0.1em] text-[var(--text-muted)]">
        Заголовок
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={120}
          required
          className="mc-input py-1 text-sm"
          placeholder="Например: Новый сезон уже в игре"
        />
      </label>
      <label className="flex flex-col gap-1 text-[0.58rem] uppercase tracking-[0.1em] text-[var(--text-muted)]">
        Текст
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={1000}
          rows={4}
          className="mc-input py-1 text-sm"
          placeholder="Коротко о главном"
        />
      </label>
      <label className="flex flex-col gap-1 text-[0.58rem] uppercase tracking-[0.1em] text-[var(--text-muted)]">
        Ссылка (необязательно)
        <input
          value={link}
          onChange={(event) => setLink(event.target.value)}
          className="mc-input py-1 text-sm"
          placeholder="/seasons/4"
        />
      </label>

      <div className="flex flex-wrap gap-4">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--text-secondary)]">
          <input
            type="checkbox"
            checked={toChat}
            onChange={(event) => setToChat(event.target.checked)}
            className="h-4 w-4 accent-[var(--mc-green)]"
          />
          Дублировать в чат сервера
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--text-secondary)]">
          <input
            type="checkbox"
            checked={toDiscord}
            onChange={(event) => setToDiscord(event.target.checked)}
            className="h-4 w-4 accent-[var(--mc-green)]"
          />
          Отправить в Discord
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy || !title.trim()}
          className="mc-btn mc-btn-primary px-3 py-1.5 text-xs disabled:opacity-55"
        >
          {busy ? "Отправляем…" : "Отправить всем"}
        </button>
        <span className="text-xs text-[var(--text-muted)]">
          Получателей: {recipients}
        </span>
      </div>

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
    </form>
  );
}
