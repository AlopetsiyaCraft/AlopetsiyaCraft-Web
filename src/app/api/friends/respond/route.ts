import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { friends } from "@/lib/db/schema";

/** POST /api/friends/respond { friendUserId, accept } — принять/отклонить входящую заявку. */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }
    const me = parseInt(session.user.id, 10);
    const body = await request.json();
    const friendUserId = parseInt(body?.friendUserId, 10);
    const accept = body?.accept === true;

    if (isNaN(friendUserId) || friendUserId === me) {
      return NextResponse.json({ error: "Некорректный собеседник" }, { status: 400 });
    }

    const a = Math.min(me, friendUserId);
    const b = Math.max(me, friendUserId);
    const pair = await db
      .select()
      .from(friends)
      .where(and(eq(friends.userId, a), eq(friends.friendId, b)))
      .get();
    if (!pair || pair.status !== "pending") {
      return NextResponse.json({ error: "Заявка не найдена" }, { status: 404 });
    }
    if (pair.requesterId === me) {
      return NextResponse.json({ error: "Это исходящая заявка" }, { status: 400 });
    }

    if (accept) {
      await db.update(friends).set({ status: "accepted" }).where(eq(friends.id, pair.id)).run();
      return NextResponse.json({ status: "accepted", message: "Вы друзья!" });
    }
    await db.delete(friends).where(eq(friends.id, pair.id)).run();
    return NextResponse.json({ status: "declined", message: "Заявка отклонена" });
  } catch (error) {
    console.error("Friend respond error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}