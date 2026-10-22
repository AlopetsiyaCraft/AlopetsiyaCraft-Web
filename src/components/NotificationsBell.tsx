"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

interface NotificationItem {
  id: number;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: number | null;
  createdAt: number;
}

const TYPE_COLORS: Record<string, string> = {
  friend: "var(--mc-green-light)",
  friend_request: "var(--mc-green-light)",
  friend_accept: "var(--mc-green-light)",
  comment: "var(--mc-blue)",
  shop: "var(--mc-gold)",
  shop_delivered: "var(--mc-green-light)",
  shop_refunded: "var(--mc-blue)",
  currency: "var(--mc-gold)",
  system: "var(--text-muted)",
};

function formatWhen(timestamp: number) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

/** Колокольчик в шапке: непрочитанные, список и «прочитать все». */
export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=20");
      if (!res.ok) return;
      const data = (await res.json()) as {
        items: NotificationItem[];
        unread: number;
      };
      setItems(data.items);
      setUnread(data.unread);
    } catch {
      // тихо: колокольчик не должен ломать страницу
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const first = window.setTimeout(() => void load(), 0);
    const id = window.setInterval(() => void load(), 30000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [load]);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function markRead(ids?: number[]) {
    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ids ? { ids } : { all: true }),
      });
      if (ids) {
        setItems((prev) =>
          prev.map((item) =>
            ids.includes(item.id) && item.readAt == null
              ? { ...item, readAt: Date.now() }
              : item
          )
        );
        setUnread((prev) => Math.max(0, prev - ids.length));
      } else {
        setItems((prev) => prev.map((item) => ({ ...item, readAt: item.readAt ?? Date.now() })));
        setUnread(0);
      }
    } catch {
      // ignore
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((prev) => !prev);
          if (!open) void load();
        }}
        className="mc-panel-flat relative flex h-9 w-9 cursor-pointer items-center justify-center transition-colors hover:bg-[var(--hover)]"
        aria-label="Уведомления"
        aria-expanded={open}
      >
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="square"
            d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center border border-black bg-[var(--mc-red)] px-0.5 font-mono text-[0.55rem] leading-none text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="mc-panel absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden">
          <div className="mc-head text-[0.68rem]">
            Уведомления
            {unread > 0 && (
              <button
                type="button"
                onClick={() => void markRead()}
                className="ml-auto cursor-pointer text-[0.58rem] font-normal normal-case tracking-normal text-[var(--mc-green-light)] hover:underline"
              >
                Прочитать все
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="p-4 text-center text-sm text-[var(--text-muted)]">Загрузка…</div>
            ) : items.length === 0 ? (
              <div className="p-4 text-center text-sm text-[var(--text-muted)]">
                Пока пусто. Здесь появятся заявки, комментарии и заказы.
              </div>
            ) : (
              <ul className="divide-y-2 divide-black/40">
                {items.map((item) => {
                  const content = (
                    <div
                      className={`flex gap-2.5 px-3 py-2.5 text-sm transition-colors hover:bg-[var(--hover)] ${
                        item.readAt == null ? "bg-[rgba(93,156,60,0.08)]" : ""
                      }`}
                    >
                      <span
                        className="mt-1 h-2 w-2 shrink-0"
                        style={{
                          backgroundColor: TYPE_COLORS[item.type] ?? "var(--text-muted)",
                        }}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <div className="leading-snug">{item.title}</div>
                        {item.body && (
                          <div className="mt-0.5 line-clamp-2 text-xs text-[var(--text-secondary)]">
                            {item.body}
                          </div>
                        )}
                        <div className="mt-1 font-mono text-[0.58rem] text-[var(--text-muted)]">
                          {formatWhen(item.createdAt)}
                        </div>
                      </div>
                      {item.readAt == null && (
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 bg-[var(--mc-green-light)]" aria-hidden />
                      )}
                    </div>
                  );

                  return (
                    <li key={item.id}>
                      {item.link ? (
                        <Link
                          href={item.link}
                          onClick={() => {
                            void markRead([item.id]);
                            setOpen(false);
                          }}
                        >
                          {content}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          className="block w-full text-left"
                          onClick={() => void markRead([item.id])}
                        >
                          {content}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
