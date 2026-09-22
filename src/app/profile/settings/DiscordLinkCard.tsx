"use client";

import { useState } from "react";

/**
 * Карточка «Интеграция Discord» на странице настроек аккаунта.
 *
 * Позволяет привязать аккаунт сайта к Discord-аккаунту:
 *  - кнопкой OAuth (если на сайте настроены DISCORD_CLIENT_ID/SECRET);
 *  - вручную — вставка Discord ID (работает всегда).
 *
 * После привязки Discord-бот покажет на сервере ник сайта и поставит
 * аватарку-голову скина, а сообщения в чате будут идти с ником сайта.
 */
export default function DiscordLinkCard({
  discordId,
  oauthUrl,
}: {
  discordId: string | null;
  /** null — OAuth не настроен на сервере (нет DISCORD_CLIENT_ID/SECRET). */
  oauthUrl: string | null;
}) {
  const [manualId, setManualId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  async function linkManual() {
    const id = manualId.trim();
    if (!/^\d{15,21}$/.test(id)) {
      setMessage({
        text: "Похоже, это не Discord ID. Скопируй его через ПКМ по своему нику → «Копировать ID» (нужно включить «Режим разработчика» в настройках Discord).",
        error: true,
      });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/discord/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "link", discordId: id }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMessage({
          text: "Аккаунт Discord привязан! Бот обновит ник и аватарку на сервере.",
          error: false,
        });
        setTimeout(() => window.location.reload(), 1200);
      } else {
        setMessage({ text: data.error || "Ошибка привязки", error: true });
      }
    } catch {
      setMessage({ text: "Сетевая ошибка при запросе", error: true });
    } finally {
      setBusy(false);
    }
  }

  async function unlink() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/discord/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unlink" }),
      });
      if (res.ok) {
        setMessage({ text: "Привязка Discord удалена.", error: false });
        setTimeout(() => window.location.reload(), 1200);
      } else {
        const data = await res.json().catch(() => ({}));
        setMessage({ text: data.error || "Ошибка отвязки", error: true });
      }
    } catch {
      setMessage({ text: "Сетевая ошибка при запросе", error: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-6">
      <h2 className="text-lg font-semibold mb-2">Интеграция Discord</h2>
      <p className="text-[var(--text-secondary)] text-sm mb-4">
        Привяжи Discord-аккаунт, чтобы на нашем Discord-сервере твой ник и
        аватарка брались с сайта, а сообщения в чат Minecraft шли с ником и
        головой сайта (не nick Discord со Стивом).
      </p>

      {discordId ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
            <span className="text-[var(--text)]">
              Привязан Discord: <span className="font-mono">{discordId}</span>
            </span>
          </div>
          <button
            onClick={unlink}
            disabled={busy}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
          >
            {busy ? "Подождите..." : "Отвязать"}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {oauthUrl ? (
            <>
              <a
                href={oauthUrl}
                className="inline-block px-4 py-2 bg-[#5865F2] hover:bg-[#4752c4] text-white text-sm rounded-lg transition-colors"
              >
                Подключить через Discord
              </a>
              <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                <div className="flex-1 h-px bg-[var(--border)]" />
                или вручную
                <div className="flex-1 h-px bg-[var(--border)]" />
              </div>
            </>
          ) : (
            <p className="text-xs text-[var(--text-muted)]">
              Кнопка входа через Discord появится, когда администратор сайта
              настроит OAuth-приложение. Пока можно привязаться вручную:
            </p>
          )}

          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-sm text-[var(--text-secondary)] mb-2">
                Discord ID
              </label>
              <input
                type="text"
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
                placeholder="Например: 418470431117410304"
                className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--text)] text-sm focus:outline-none focus:border-[#7c3aed]"
              />
            </div>
            <button
              onClick={linkManual}
              disabled={busy || !manualId.trim()}
              className="px-4 py-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? "Подождите..." : "Привязать"}
            </button>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Как узнать свой ID: включи в Discord «Настройки → Дополнительно →
            Режим разработчика», затем ПКМ по своему нику → «Копировать ID».
          </p>
        </div>
      )}

      {message && (
        <p
          className={`mt-3 text-sm ${
            message.error ? "text-red-500" : "text-green-500"
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}