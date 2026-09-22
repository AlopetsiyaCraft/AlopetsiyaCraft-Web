import { NextRequest, NextResponse } from "next/server";
import { asc, and, gt, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { chatLogs } from "@/lib/db/schema";
import { checkBridgeKey, getActiveSeasonId } from "@/lib/bridge";

const MAX_NICKNAME = 32;
const MAX_MESSAGE = 500;

/**
 * Мост чата Minecraft-сервера (мод chatbridge) ↔ сайт.
 *
 * POST /api/chat/from-server  — мод шлёт { nickname, message }
 *   (игровой чат, join/leave). Сохраняется с source="minecraft".
 * GET  /api/chat/from-server?since=<мс> — мод/бот поллит новые сообщения.
 *   Возвращает только source = "website" | "discord" (свои же сообщения
 *   с сервера исключаются, чтобы мод не выводил их в игру повторно — эхо).
 *   createdAt отдаётся в ЧИЛОСЕКУНДАХ, как ожидает мод (System.currentTimeMillis()).
 *
 * Оба запроса требуют заголовок `x-api-key`, совпадающий с CHAT_API_KEY в .env.
 */
export async function POST(request: NextRequest) {
  if (!checkBridgeKey(request.headers.get("x-api-key"))) {
    return NextResponse.json({ error: "Неверный ключ API" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const nickname = typeof body?.nickname === "string" ? body.nickname.trim().slice(0, MAX_NICKNAME) : "";
  const message = typeof body?.message === "string" ? body.message.trim().slice(0, MAX_MESSAGE) : "";

  if (!nickname || !message) {
    return NextResponse.json({ error: "nickname и message обязательны" }, { status: 400 });
  }

  const seasonId = await getActiveSeasonId();

  await db
    .insert(chatLogs)
    .values({
      seasonId,
      nickname,
      message,
      source: "minecraft",
    })
    .run();

  return NextResponse.json({ message: "OK" });
}

export async function GET(request: NextRequest) {
  if (!checkBridgeKey(request.headers.get("x-api-key"))) {
    return NextResponse.json({ error: "Неверный ключ API" }, { status: 401 });
  }

  const rawSince = request.nextUrl.searchParams.get("since");
  const sinceMs = rawSince ? parseInt(rawSince, 10) : 0;
  const sinceSec = Number.isFinite(sinceMs) ? Math.floor(sinceMs / 1000) : 0;

  const rows = await db
    .select({
      id: chatLogs.id,
      source: chatLogs.source,
      nickname: chatLogs.nickname,
      message: chatLogs.message,
      createdAt: chatLogs.createdAt,
    })
    .from(chatLogs)
    .where(and(gt(chatLogs.createdAt, new Date(sinceSec * 1000)), ne(chatLogs.source, "minecraft")))
    .orderBy(asc(chatLogs.createdAt))
    .limit(200)
    .all();

  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      source: r.source,
      nickname: r.nickname,
      message: r.message,
      createdAt: r.createdAt.getTime(),
    }))
  );
}