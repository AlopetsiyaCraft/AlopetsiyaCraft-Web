import { NextRequest, NextResponse } from "next/server";
import { asc, and, eq, gt, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { chatLogs, users } from "@/lib/db/schema";
import { checkBridgeKey, getActiveSeasonId } from "@/lib/bridge";
import { notifyDiscord } from "@/lib/discord";

const MAX_NICKNAME = 32;
const MAX_MESSAGE = 500;

/** Источники, которые умеет принимать мост. */
const BRIDGE_SOURCES = ["minecraft", "website", "discord"] as const;

/**
 * Мост чата Minecraft-сервера (мод chatbridge) ↔ сайт ↔ Discord.
 *
 * POST /api/chat/from-server  — внешние системы шлют { nickname, message, [source] }:
 *   - мод: игровой чат и join/leave (source по умолчанию "minecraft");
 *   - Discord-бот: сообщения из канала (source = "discord").
 *   Сообщения не из Discord дополнительно пушатся в вебхук Discord
 *   (см. src/lib/discord.ts).
 * GET  /api/chat/from-server?since=<мс> — мод поллит новые сообщения.
 *   Возвращает только source = "website" | "discord" (свои же сообщения
 *   с сервера исключаются, чтобы мод не выводил их в игру повторно — эхо).
 *   createdAt отдаётся в МИЛЛИСЕКУНДАХ, как ожидает мод (System.currentTimeMillis()).
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
  const source = BRIDGE_SOURCES.includes(body?.source) ? body.source : "minecraft";

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
      source,
    })
    .run();

  // Уведомляем Discord (только не для сообщений, пришедших из Discord — иначе эхо).
  if (source !== "discord") {
    await notifyDiscord({ source, nickname, message });
  }

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
      skinUrl: users.skinUrl,
    })
    .from(chatLogs)
    .leftJoin(users, eq(chatLogs.nickname, users.nickname))
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
      skinUrl: r.skinUrl,
    }))
  );
}