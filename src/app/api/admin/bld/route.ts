import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

/**
 * POST /api/admin/bld { nickname, amount }
 * Начислить (amount > 0) или списать (amount < 0) Болды (BLD) игроку.
 * Баланс не уходит ниже 0. Доступно только админам (users.role === "admin").
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }

    const me = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, parseInt(session.user.id, 10)))
      .get();
    if (me?.role !== "admin") {
      return NextResponse.json({ error: "Нет прав" }, { status: 403 });
    }

    const body = await request.json();
    const nickname = typeof body?.nickname === "string" ? body.nickname.trim() : "";
    const amount = Number(body?.amount);

    if (!nickname) {
      return NextResponse.json({ error: "nickname обязателен" }, { status: 400 });
    }
    if (!Number.isInteger(amount)) {
      return NextResponse.json({ error: "amount должен быть целым числом" }, { status: 400 });
    }

    const target = await db
      .select({ id: users.id, bld: users.bld })
      .from(users)
      .where(eq(users.nickname, nickname))
      .get();
    if (!target) {
      return NextResponse.json({ error: `Игрок ${nickname} не найден` }, { status: 404 });
    }

    const current = target.bld ?? 0;
    const next = Math.max(0, current + amount);
    await db.update(users).set({ bld: next }).where(eq(users.id, target.id)).run();

    return NextResponse.json({ nickname, amount, balance: next });
  } catch (error) {
    console.error("Admin BLD error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}