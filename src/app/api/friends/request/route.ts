import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { friends, users } from "@/lib/db/schema";

/**
 * POST /api/friends/request { nickname } — отправить заявку в друзья.
 * Если заявка от собеседника уже входящая — автоматически принимаем (VK-стиль).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }
    const me = parseInt(session.user.id, 10);
    const body = await request.json();
    const nickname = (body?.nickname ?? "").toString().trim();
    if (!nickname) {
      return NextResponse.json({ error: "Укажите никнейм" }, { status: 400 });
    }

    const target = await db.select().from(users).where(eq(users.nickname, nickname)).get();
    if (!target) {
      return NextResponse.json({ error: "Игрок не найден" }, { status: 404 });
    }
    if (target.id === me) {
      return NextResponse.json({ error: "Нельзя добавить самого себя" }, { status: 400 });
    }

    const a = Math.min(me, target.id);
    const b = Math.max(me, target.id);
    const pair = await db
      .select()
      .from(friends)
      .where(and(eq(friends.userId, a), eq(friends.friendId, b)))
      .get();

    if (!pair) {
      await db
        .insert(friends)
        .values({ userId: a, friendId: b, requesterId: me, status: "pending" })
        .run();
      return NextResponse.json({ status: "requested", message: "Заявка отправлена" }, { status: 201 });
    }

    if (pair.status === "accepted") {
      return NextResponse.json({ error: "Вы уже друзья" }, { status: 400 });
    }
    if (pair.requesterId === me) {
      return NextResponse.json({ error: "Заявка уже отправлена" }, { status: 400 });
    }
    // входящая заявка от собеседника → принимаем
    await db.update(friends).set({ status: "accepted" }).where(eq(friends.id, pair.id)).run();
    return NextResponse.json({ status: "accepted", message: "Заявка принята — вы друзья!" });
  } catch (error) {
    console.error("Friend request error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}