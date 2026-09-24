import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { achievements, users } from "@/lib/db/schema";

/**
 * Последние достижения игроков — публичный эндпоинт для блока
 * «Достижения» на главной.
 *
 * GET /api/achievements/latest?limit=20
 * Возвращает свежие к новым, вместе с skinUrl игрока (если ник привязан
 * к аккаунту сайта — иначе null, тогда клиент рисует заглушку-букву).
 */
export async function GET(request: NextRequest) {
  const raw = Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "20", 10);
  const limit = Number.isFinite(raw) ? Math.min(Math.max(raw, 1), 100) : 20;

  const rows = await db
    .select({
      id: achievements.id,
      nickname: achievements.nickname,
      advancementId: achievements.advancementId,
      title: achievements.title,
      description: achievements.description,
      frame: achievements.frame,
      icon: achievements.icon,
      createdAt: achievements.createdAt,
      skinUrl: users.skinUrl,
    })
    .from(achievements)
    .leftJoin(users, eq(achievements.nickname, users.nickname))
    .orderBy(desc(achievements.createdAt))
    .limit(limit)
    .all();

  return NextResponse.json(rows.map((r) => ({ ...r, createdAt: r.createdAt.getTime() })));
}