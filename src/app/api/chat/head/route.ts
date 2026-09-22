import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

/**
 * Публичный эндпоинт для внешности игрока (моды chatbridge и
 * AlopetsiyaSkinsAndCapes).
 *
 * GET /api/chat/head?nickname=<ник>  →
 *   { skinUrl, capeUrl, skinModel } | { skinUrl: null, capeUrl: null, skinModel: "wide" }
 *
 * Мод скинов качает отсюда всё разом: URL скина, URL плаща и модель
 * (wide = Стив / slim = Алекс, выбирается игроком в настройках сайта).
 * Мод ChatHeads использует только skinUrl (кроп головы 8x8 из 64x64).
 * Публичный — незачем требовать ключ: данные и так открытые (как GET /api/chat).
 */
export async function GET(request: NextRequest) {
  const nickname = request.nextUrl.searchParams.get("nickname")?.trim().slice(0, 32) ?? "";

  if (!nickname) {
    return NextResponse.json({ skinUrl: null, capeUrl: null, skinModel: "wide" });
  }

  const user = await db
    .select({ skinUrl: users.skinUrl, capeUrl: users.capeUrl, skinModel: users.skinModel })
    .from(users)
    .where(eq(users.nickname, nickname))
    .get();

  return NextResponse.json({
    skinUrl: user?.skinUrl ?? null,
    capeUrl: user?.capeUrl ?? null,
    skinModel: user?.skinModel ?? "wide",
  });
}
