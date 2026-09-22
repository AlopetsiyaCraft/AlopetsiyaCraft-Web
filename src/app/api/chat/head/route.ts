import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

/**
 * Публичный эндпоинт для голов в чате Minecraft (мод chatbridge).
 *
 * GET /api/chat/head?nickname=<ник>  →  { skinUrl: "/uploads/skins/skin-5.png" } | null
 *
 * Клиентская часть мода по нику автора сообщения запрашивает здесь ссылку
 * на скин пользователя с сайта, скачивает PNG и кропит голову (8x8 из 64x64).
 * Публичный — незачем требовать ключ: данные и так открытые (как GET /api/chat).
 */
export async function GET(request: NextRequest) {
  const nickname = request.nextUrl.searchParams.get("nickname")?.trim().slice(0, 32) ?? "";

  if (!nickname) {
    return NextResponse.json({ skinUrl: null });
  }

  const user = await db
    .select({ skinUrl: users.skinUrl })
    .from(users)
    .where(eq(users.nickname, nickname))
    .get();

  return NextResponse.json({ skinUrl: user?.skinUrl ?? null });
}