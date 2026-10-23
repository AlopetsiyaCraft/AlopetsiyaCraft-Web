"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const SESSION_KEY = "analyticsSession";

function getSessionId(): string {
  try {
    const saved = localStorage.getItem(SESSION_KEY);
    if (saved && /^[a-zA-Z0-9_-]{8,64}$/.test(saved)) return saved;
    const id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

/**
 * Простая аналитика просмотров: анонимный id в localStorage, путь страницы
 * и источник. Нужна только чтобы видеть мёртвые разделы в /admin/analytics.
 */
export default function AnalyticsTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    // Служебные адреса не считаем.
    if (pathname.startsWith("/api") || pathname.startsWith("/_next")) return;

    const source =
      document.documentElement.dataset.telegram === "1" || /tgWebApp/i.test(location.hash)
        ? "telegram"
        : "web";

    const payload = JSON.stringify({
      path: pathname,
      sessionId: getSessionId(),
      source,
      referrer: document.referrer || null,
    });

    fetch("/api/analytics/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {
      // Аналитика не должна мешать сайту.
    });
  }, [pathname]);

  return null;
}
