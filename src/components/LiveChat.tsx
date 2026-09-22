"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";

interface ChatMessage {
  id: number;
  nickname: string;
  message: string;
  createdAt: string;
  skinUrl: string | null;
}

function ChatHead({ skinUrl, nickname }: { skinUrl: string | null; nickname: string }) {
  if (!skinUrl) {
    return (
      <div className="w-10 h-10 flex-shrink-0 bg-[#7c3aed] flex items-center justify-center text-sm font-bold rounded">
        {nickname[0]?.toUpperCase() || "?"}
      </div>
    );
  }

  return (
    <div className="w-10 h-10 flex-shrink-0 relative overflow-hidden rounded">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${skinUrl})`,
          backgroundSize: "320px 320px",
          backgroundPosition: "-40px -40px",
          imageRendering: "pixelated",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${skinUrl})`,
          backgroundSize: "320px 320px",
          backgroundPosition: "-200px -40px",
          imageRendering: "pixelated",
        }}
      />
    </div>
  );
}

export default function LiveChat({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
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
   * Прокручиваем именно контейнер чата до маркера в конце списка.
   * scrollIntoView({ block: "end" }) сам находит ближайший скроллящийся
   * предок — то есть наш h-96 блок — и не трогает страницу.
   */
  const scrollToBottom = useCallback(() => {
    const end = endRef.current;
    if (!end) return;
    end.scrollIntoView({ block: "end" });
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  async function fetchMessages() {
    try {
      const res = await fetch("/api/chat?limit=50");
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (error) {
      console.error("Failed to fetch chat:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 500);
    return () => clearInterval(interval);
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
    return d.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-2">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        <h2 className="font-semibold">Чат сервера</h2>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-96 overflow-y-auto p-4 space-y-4 custom-scrollbar"
      >
        {loading ? (
          <div className="flex items-center justify-center h-full text-[var(--text-muted)]">
            Загрузка...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[var(--text-muted)]">
            Пока нет сообщений
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="flex items-start gap-3">
              <Link href={`/profile?user=${msg.nickname}`} className="mt-1">
                <ChatHead skinUrl={msg.skinUrl} nickname={msg.nickname} />
              </Link>
              <div className="flex-1 min-w-0">
                <div className="mb-1">
                  <Link
                    href={`/profile?user=${msg.nickname}`}
                    className="font-semibold text-sm text-[var(--text)] hover:underline"
                  >
                    {msg.nickname}
                  </Link>
                </div>
                <div className="flex items-end gap-2 pr-1">
                  <div className="bg-[var(--bubble)] rounded-2xl rounded-tl-sm px-4 py-2" style={{ maxWidth: "calc(100% - 60px)" }}>
                    <p className="text-[var(--text-secondary)] text-sm break-words whitespace-pre-wrap">{msg.message}</p>
                  </div>
                  <div className="flex-1" />
                  <span className="text-[11px] text-[var(--text-muted)] whitespace-nowrap flex-shrink-0 pb-0.5">
                    {formatTime(msg.createdAt)}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={endRef} aria-hidden="true" className="h-px" />
      </div>

      <div className="px-4 py-3 border-t border-[var(--border)]">
        {isLoggedIn ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Написать сообщение..."
              maxLength={500}
              className="flex-1 px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--text)] text-sm focus:outline-none focus:border-[#7c3aed]"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="px-4 py-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? "..." : "Отправить"}
            </button>
          </div>
        ) : (
          <div className="text-sm text-[var(--text-secondary)]">
            Чтобы писать сообщения,{" "}
            <Link href="/auth/login" className="text-[#7c3aed] hover:underline">
              войдите в свой аккаунт
            </Link>{" "}
            или{" "}
            <Link href="/auth/register" className="text-[#7c3aed] hover:underline">
              зарегистрируйтесь
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
