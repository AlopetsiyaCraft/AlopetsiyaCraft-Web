import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

/**
 * Привязка Discord-аккаунта к текущему (залогиненному) пользователю сайта.
 * Сессионный аналог /api/discord (POST/DELETE для бота, x-api-key):
 * здесь пользователь сам привязывает/отвязывает свой аккаунт.
 *
 * POST /api/discord/me { action: "link", discordId }   — привязать
 * POST /api/discord/me { action: "unlink" }            — отвязать
 *
 * Привязка «переезжает»: если этот Discord ID уже привязан к другому
 * пользователю сайта, он открепляется от него (повторная привязка).
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  const userId = Number.parseInt(session?.user?.id ?? "", 10);
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const action = body?.action;
  const discordId = typeof body?.discordId === "string" ? body.discordId.trim() : "";

  if (action === "unlink") {
    await db.update(users).set({ discordId: null }).where(eq(users.id, userId)).run();
    return NextResponse.json({ message: "OK" });
  }

  if (action === "link") {
    if (!/^\d{15,21}$/.test(discordId)) {
      return NextResponse.json({ error: "Некорректный Discord ID" }, { status: 400 });
    }
    // Снимаем привязку с другого аккаунта сайта, если она была.
    await db.update(users).set({ discordId: null }).where(eq(users.discordId, discordId)).run();
    await db.update(users).set({ discordId }).where(eq(users.id, userId)).run();
    return NextResponse.json({ message: "OK", discordId });
  }

  return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
}