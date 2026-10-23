import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { pageViews } from "@/lib/db/schema";

/** Повторный заход на ту же страницу в течение получаса не считаем. */
const DEDUPE_MINUTES = 30;

/**
 * Быстрый фильтр повторов в памяти процесса. Нужен из-за гонки: React
 * в dev-режиме может отправить два одинаковых запроса одновременно,
 * и оба успевают пройти проверку в БД до вставки.
 */
const recentViews = new Map<string, number>();

function seenRecently(key: string): boolean {
  const now = Date.now();
  const last = recentViews.get(key);
  if (last && now - last < DEDUPE_MINUTES * 60 * 1000) return true;
  recentViews.set(key, now);
  if (recentViews.size > 2000) {
    for (const [item, timestamp] of recentViews) {
      if (now - timestamp > DEDUPE_MINUTES * 60 * 1000) recentViews.delete(item);
    }
  }
  return false;
}

function normalizePath(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.startsWith("/")) return null;
  const path = raw.split("?")[0].split("#")[0];
  if (path.startsWith("/api/") || path.startsWith("/_next") || path.startsWith("/uploads")) {
    return null;
  }
  // Динамические страницы не должны плодить сотни строк в отчёте.
  if (path.startsWith("/profile/")) return "/profile/*";
  if (/^\/seasons\/\d+/.test(path)) return "/seasons/*";
  return path.slice(0, 200);
}

function detectDevice(userAgent: string): "desktop" | "mobile" | "tablet" {
  if (/iPad|Tablet|PlayBook|Silk/i.test(userAgent)) return "tablet";
  if (/Android/i.test(userAgent) && !/Mobile/i.test(userAgent)) return "tablet";
  if (/Mobi|Android|iPhone|iPod/i.test(userAgent)) return "mobile";
  return "desktop";
}

/**
 * POST /api/analytics/view { path, sessionId, source?, referrer?, telegram? }
 * Анонимный просмотр страницы. IP не сохраняем, cookie не ставим.
 */
export async function POST(request: NextRequest) {
  const userAgent = request.headers.get("user-agent") ?? "";
  if (/bot|crawler|spider|preview/i.test(userAgent)) {
    return NextResponse.json({ ok: true, skipped: "bot" });
  }

  const body = await request.json().catch(() => null);
  const path = normalizePath(body?.path);
  if (!path) {
    return NextResponse.json({ error: "Некорректный путь" }, { status: 400 });
  }

  const sessionId =
    typeof body?.sessionId === "string" && /^[a-zA-Z0-9_-]{8,64}$/.test(body.sessionId)
      ? body.sessionId
      : crypto.randomUUID();

  const source =
    body?.source === "telegram" || body?.telegram === true ? "telegram" : "web";
  const referrer =
    typeof body?.referrer === "string" && body.referrer && !body.referrer.startsWith("http://localhost")
      ? body.referrer.slice(0, 300)
      : null;

  if (seenRecently(`${sessionId}|${path}`)) {
    return NextResponse.json({ ok: true, skipped: "recent" });
  }

  try {
    const recent = await db
      .select({ id: pageViews.id })
      .from(pageViews)
      .where(
        and(
          eq(pageViews.sessionId, sessionId),
          eq(pageViews.path, path),
          gte(pageViews.createdAt, new Date(Date.now() - DEDUPE_MINUTES * 60 * 1000))
        )
      )
      .limit(1)
      .get();
    if (recent) {
      return NextResponse.json({ ok: true, skipped: "recent" });
    }

    const session = await auth();
    const parsedUserId = session?.user?.id ? Number(session.user.id) : null;

    await db
      .insert(pageViews)
      .values({
        path,
        sessionId,
        userId: Number.isInteger(parsedUserId) ? parsedUserId : null,
        device: detectDevice(userAgent),
        source,
        referrer,
      })
      .run();

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Analytics view error:", error);
    return NextResponse.json({ error: "Не удалось записать просмотр" }, { status: 500 });
  }
}
