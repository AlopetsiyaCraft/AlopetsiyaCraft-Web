import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, mcSessions } from "@/lib/db/schema";
import { checkBridgeKey } from "@/lib/bridge";

const MAX_NICKNAME = 32;
const MAX_PASSWORD = 128;
// Срок жизни сессии входа на сервер: MC_SESSION_TTL_DAYS в .env (по умолчанию 7 дней).
const SESSION_TTL_DAYS = Number(process.env.MC_SESSION_TTL_DAYS ?? 7);

// Простая защита от перебора: не больше 10 неудачных попыток с одного IP за 10 минут.
const FAIL_WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILS = 10;
const failCounts = new Map<string, { count: number; windowStart: number }>();

/**
 * Логин на Minecraft-сервер паролем от сайта (мод AlopetsiyaAuth).
 *
 * POST /api/auth/mc-login — тело:
 *   { "nickname": "AlexMilash", "password": "...", "ip": "1.2.3.4" }
 *
 * Пароль сверяется с bcrypt-хэшем пользователя сайта (регистр ника не важен).
 * При успехе создаётся сессия (ник + IP + срок жизни SESSION_TTL_DAYS),
 * старая сессия игрока заменяется — дальше /api/auth/mc-check пропустит
 * игрока без пароля, пока он заходит с того же IP.
 *
 * Требует заголовок `x-api-key` = CHAT_API_KEY.
 */
export async function POST(request: NextRequest) {
  if (!checkBridgeKey(request.headers.get("x-api-key"))) {
    return NextResponse.json({ error: "Неверный ключ API" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const nickname =
    typeof body?.nickname === "string" ? body.nickname.trim().slice(0, MAX_NICKNAME) : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const ip = typeof body?.ip === "string" ? body.ip.trim() : "";

  if (!nickname || !password || !ip) {
    return NextResponse.json(
      { error: "Поля nickname, password и ip обязательны" },
      { status: 400 }
    );
  }
  if (password.length < 6 || password.length > MAX_PASSWORD) {
    return NextResponse.json({ authorized: false, error: "Неверный ник или пароль" });
  }

  const now = Date.now();

  // Лимит неудачных попыток с одного IP.
  const fail = failCounts.get(ip);
  if (fail && now - fail.windowStart < FAIL_WINDOW_MS && fail.count >= MAX_FAILS) {
    return NextResponse.json(
      { authorized: false, error: "Слишком много попыток входа, подождите немного" },
      { status: 429 }
    );
  }

  const lower = nickname.toLowerCase();
  const user = await db
    .select({ id: users.id, nickname: users.nickname, passwordHash: users.passwordHash })
    .from(users)
    .where(sql`lower(${users.nickname}) = ${lower}`)
    .get();

  const failLogin = () => {
    const entry = failCounts.get(ip);
    if (entry && now - entry.windowStart < FAIL_WINDOW_MS) {
      entry.count++;
    } else {
      failCounts.set(ip, { count: 1, windowStart: now });
    }
    return NextResponse.json({ authorized: false, error: "Неверный ник или пароль" });
  };

  if (!user) return failLogin();

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) return failLogin();

  // Успех — сброс счётчика попыток и замена прошлой сессии игрока на новую.
  failCounts.delete(ip);

  const expiresAt = new Date(now + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  const token = randomUUID();

  try {
    await db.delete(mcSessions).where(eq(mcSessions.userId, user.id)).run();
    await db
      .insert(mcSessions)
      .values({ userId: user.id, nickname: user.nickname, ip, token, expiresAt })
      .run();
  } catch (error) {
    console.error("mc-login session insert error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }

  return NextResponse.json({
    authorized: true,
    nickname: user.nickname,
    sessionTtlDays: SESSION_TTL_DAYS,
  });
}