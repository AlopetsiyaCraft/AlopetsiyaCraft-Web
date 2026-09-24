import { NextRequest, NextResponse } from "next/server";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, mcSessions } from "@/lib/db/schema";
import { checkBridgeKey } from "@/lib/bridge";

const MAX_NICKNAME = 32;

/**
 * Проверка игрока перед входом на Minecraft-сервер (мод AlopetsiyaAuth).
 *
 * POST /api/auth/mc-check  — тело: { "nickname": "AlexMilash", "ip": "1.2.3.4" }
 *
 *   - registered — зарегистрирован ли такой ник на сайте (вайтлист: если нет —
 *     мод кикает игрока с сообщением «зарегистрируйся на сайте»);
 *   - authorized — есть ли живая сессия с этого IP (пароль при входе не нужен).
 *
 * Ник ищется без учёта регистра, IP сравнивается как есть. Требует заголовок
 * `x-api-key` = CHAT_API_KEY (тот же, что у чат-моста).
 */
export async function POST(request: NextRequest) {
  if (!checkBridgeKey(request.headers.get("x-api-key"))) {
    return NextResponse.json({ error: "Неверный ключ API" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const nickname =
    typeof body?.nickname === "string" ? body.nickname.trim().slice(0, MAX_NICKNAME) : "";
  const ip = typeof body?.ip === "string" ? body.ip.trim() : "";

  if (!nickname || !ip) {
    return NextResponse.json(
      { error: "Поля nickname и ip обязательны" },
      { status: 400 }
    );
  }

  const lower = nickname.toLowerCase();

  const user = await db
    .select({ id: users.id, nickname: users.nickname })
    .from(users)
    .where(sql`lower(${users.nickname}) = ${lower}`)
    .get();

  if (!user) {
    return NextResponse.json({ registered: false, authorized: false });
  }

  const session = await db
    .select({ id: mcSessions.id })
    .from(mcSessions)
    .where(
      and(
        sql`lower(${mcSessions.nickname}) = ${lower}`,
        eq(mcSessions.ip, ip),
        gt(mcSessions.expiresAt, new Date())
      )
    )
    .limit(1)
    .get();

  return NextResponse.json({
    registered: true,
    authorized: !!session,
    // Показываем канонический ник сайта (регистр) — мод пускает под ним.
    nickname: user.nickname,
  });
}