import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { checkBridgeKey } from "@/lib/bridge";

const MAX_NICKNAME = 32;
const MAX_ID = 40;

/**
 * Связка Discord-аккаунтов с профилями сайта (используется Discord-ботом).
 *
 * GET    /api/discord?discordId=<id>  — резолв: профиль сайта по Discord ID.
 *         Бот так узнаёт ник сайта, чтобы переименовать участника канала.
 *         404 — аккаунт не привязан.
 * POST   /api/discord { nickname, discordId } — привязать профиль сайта
 *         к Discord-аккаунту (перепривязка — просто повторный POST).
 * DELETE /api/discord { nickname } — отвязать.
 *
 * Все методы требуют заголовок x-api-key (CHAT_API_KEY из .env).
 */
export async function GET(request: NextRequest) {
  if (!checkBridgeKey(request.headers.get("x-api-key"))) {
    return NextResponse.json({ error: "Неверный ключ API" }, { status: 401 });
  }
  const discordId = (request.nextUrl.searchParams.get("discordId") ?? "").trim();
  if (!discordId) {
    return NextResponse.json({ error: "discordId обязателен" }, { status: 400 });
  }
  const user = await db
    .select({ nickname: users.nickname, skinUrl: users.skinUrl })
    .from(users)
    .where(eq(users.discordId, discordId))
    .limit(1)
    .get();
  if (!user) {
    return NextResponse.json({ error: "Аккаунт не привязан" }, { status: 404 });
  }
  return NextResponse.json(user);
}

export async function POST(request: NextRequest) {
  if (!checkBridgeKey(request.headers.get("x-api-key"))) {
    return NextResponse.json({ error: "Неверный ключ API" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const nickname = typeof body?.nickname === "string" ? body.nickname.trim().slice(0, MAX_NICKNAME) : "";
  const discordId = typeof body?.discordId === "string" ? body.discordId.trim().slice(0, MAX_ID) : "";
  if (!nickname || !discordId) {
    return NextResponse.json({ error: "nickname и discordId обязательны" }, { status: 400 });
  }
  const target = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.nickname, nickname))
    .limit(1)
    .get();
  if (!target) {
    return NextResponse.json({ error: "Пользователь с таким ником не найден" }, { status: 404 });
  }
  await db.update(users).set({ discordId }).where(eq(users.id, target.id)).run();
  return NextResponse.json({ message: "OK", nickname, discordId });
}

export async function DELETE(request: NextRequest) {
  if (!checkBridgeKey(request.headers.get("x-api-key"))) {
    return NextResponse.json({ error: "Неверный ключ API" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const nickname = typeof body?.nickname === "string" ? body.nickname.trim().slice(0, MAX_NICKNAME) : "";
  if (!nickname) {
    return NextResponse.json({ error: "nickname обязателен" }, { status: 400 });
  }
  const target = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.nickname, nickname))
    .limit(1)
    .get();
  if (!target) {
    return NextResponse.json({ error: "Пользователь с таким ником не найден" }, { status: 404 });
  }
  await db.update(users).set({ discordId: null }).where(eq(users.id, target.id)).run();
  return NextResponse.json({ message: "OK" });
}