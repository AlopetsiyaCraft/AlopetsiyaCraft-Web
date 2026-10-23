"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useChatDock } from "@/lib/chat-dock";
import { SYSTEM_NICKNAME } from "@/lib/chatSystem";
import PlayerHead from "@/components/mc/PlayerHead";
import { nickColorValue, profileFrameStyle } from "@/lib/profileCustomization";

/** Обработчики для шапки чата в режиме «перетаскиваемого окна» (передаёт FloatingChat). */
export interface HeaderDragProps {
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  dragging: boolean;
}

interface ChatMessage {
  id: number;
  nickname: string;
  message: string;
  createdAt: string;
  skinUrl: string | null;
  nickColor: string | null;
  frame: string | null;
}

export default function LiveChat({
  isLoggedIn,
  headerDragProps,
}: {
  isLoggedIn: boolean;
  /** В плавающем окне шапка — ручка перетаскивания; в закреплённом чате не передаётся. */
  headerDragProps?: HeaderDragProps;
}) {
  const { pinned, setPinned } = useChatDock();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);

  const checkIfAtBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  }, []);

  function handleScroll() {
    shouldAutoScroll.current = checkIfAtBottom();
  }

  /**
   * Прокручиваем только контейнер чата до конца.
   * Никакого scrollIntoView: он умеет прокручивать ВСЕ внешние контейнеры,
   * то есть и саму страницу — из-за этого при скролле вниз мимо чата
   * страницу каждые полсекунды рвало обратно наверх.
   */
  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  }, []);

  async function fetchMessages() {
    try {
      const res = await fetch("/api/chat?limit=50");
      if (res.ok) {
        setMessages(await res.json());
      }
    } catch (error) {
      console.error("Failed to fetch chat:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/chat?limit=50");
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setMessages(data);
        }
      } catch (error) {
        console.error("Failed to fetch chat:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 500);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (shouldAutoScroll.current) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom]);

  async function handleSend() {
    if (!input.trim() || sending) return;

    setSending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input.trim() }),
      });

      if (res.ok) {
        setInput("");
        shouldAutoScroll.current = true;
        await fetchMessages();
        scrollToBottom();
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="mc-panel mb-6 flex flex-col overflow-hidden">
      <div
        className={`mc-head${headerDragProps ? " select-none" : ""}`}
        {...(headerDragProps
          ? {
              onPointerDown: headerDragProps.onPointerDown,
              onPointerMove: headerDragProps.onPointerMove,
              onPointerUp: headerDragProps.onPointerUp,
              style: {
                touchAction: "none" as const,
                cursor: headerDragProps.dragging ? "grabbing" : "grab",
              },
            }
          : {})}
      >
        <span className="flex shrink-0 items-center text-[var(--mc-green-light)]">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
            <path strokeLinecap="square" d="M21 15a2 2 0 01-2 2H8l-5 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        </span>
        <h2 className="min-w-0 flex-1 truncate text-[0.78rem] font-bold uppercase tracking-[0.12em]">
          Чат сервера
        </h2>
        <span className="mc-chip flex items-center gap-1.5 text-[0.6rem] text-[var(--mc-green-light)]">
          <span className="h-1.5 w-1.5 animate-pulse bg-[var(--mc-green-light)]" aria-hidden />
          live
        </span>
        <button
          type="button"
          onClick={() => setPinned(!pinned)}
          title={pinned ? "Открепить чат (в плавающее окно)" : "Закрепить чат на главной"}
          aria-label={pinned ? "Открепить чат" : "Закрепить чат"}
          className="ml-1 flex h-7 w-7 cursor-pointer items-center justify-center border-2 border-black bg-[var(--card)] text-[var(--text-muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)]"
        >
          {pinned ? (
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="square" d="M9 21H3v-6M14 10L3 21M6 13V6a2 2 0 012-2h9a2 2 0 012 2v9a2 2 0 01-2 2h-6" />
            </svg>
          ) : (
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="square" d="M15 3h6v6M10 14L21 3M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
            </svg>
          )}
        </button>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="custom-scrollbar h-80 space-y-3 overflow-y-auto p-3"
      >
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">
            Загрузка…
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-[var(--text-muted)]">
            <span className="text-2xl">💬</span>
            Пока нет сообщений
          </div>
        ) : (
          messages.map((msg) => {
            const isSystem = msg.nickname === SYSTEM_NICKNAME;
            return (
              <div key={msg.id} className="flex items-start gap-2.5">
                <div className="mt-0.5" style={profileFrameStyle(msg.frame)}>
                  {isSystem ? (
                    <PlayerHead skinUrl={msg.skinUrl} nickname={msg.nickname} size={30} />
                  ) : (
                    <Link href={`/profile/${encodeURIComponent(msg.nickname)}`}>
                      <PlayerHead skinUrl={msg.skinUrl} nickname={msg.nickname} size={30} />
                    </Link>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-baseline gap-2">
                    {isSystem ? (
                      <span className="text-xs font-bold uppercase tracking-wider text-[var(--mc-gold)]">
                        {msg.nickname}
                      </span>
                    ) : (
                      <Link
                        href={`/profile/${encodeURIComponent(msg.nickname)}`}
                        className="text-xs font-bold uppercase tracking-wider text-[var(--mc-green-light)] hover:underline"
                        style={{ color: nickColorValue(msg.nickColor) ?? undefined }}
                      >
                        {msg.nickname}
                      </Link>
                    )}
                    <span className="font-mono text-[10px] text-[var(--text-muted)]">
                      {formatTime(msg.createdAt)}
                    </span>
                  </div>
                  <div
                    className={`inline-block max-w-full border-2 border-black px-2.5 py-1.5 text-sm leading-snug break-words whitespace-pre-wrap ${
                      isSystem
                        ? "bg-[rgba(242,201,76,0.12)] text-[var(--mc-gold)]"
                        : "bg-[var(--bubble)] text-[var(--text-secondary)]"
                    }`}
                  >
                    {msg.message}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t-2 border-black bg-[var(--card-alt)] p-3">
        {isLoggedIn ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Написать сообщение…"
              maxLength={500}
              className="mc-input flex-1"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="mc-btn mc-btn-primary shrink-0"
            >
              {sending ? "…" : "Отправить"}
            </button>
          </div>
        ) : (
          <div className="text-sm text-[var(--text-secondary)]">
            Чтобы писать сообщения,{" "}
            <Link href="/auth/login" className="font-semibold text-[var(--mc-green-light)] hover:underline">
              войдите
            </Link>{" "}
            или{" "}
            <Link href="/auth/register" className="font-semibold text-[var(--mc-green-light)] hover:underline">
              зарегистрируйтесь
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
