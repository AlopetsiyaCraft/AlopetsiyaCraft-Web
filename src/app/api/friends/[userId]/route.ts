import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { friends } from "@/lib/db/schema";

/** DELETE /api/friends/[friendUserId] — удалить друга / отменить исходящую / отклонить входящую. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }
    const me = parseInt(session.user.id, 10);
    const { userId } = await params;
    const otherId = parseInt(userId, 10);
    if (isNaN(otherId)) {
      return NextResponse.json({ error: "Некорректный собеседник" }, { status: 400 });
    }

    const a = Math.min(me, otherId);
    const b = Math.max(me, otherId);
    const pair = await db
      .select()
      .from(friends)
      .where(and(eq(friends.userId, a), eq(friends.friendId, b)))
      .get();
    if (!pair) {
      return NextResponse.json({ error: "Связь не найдена" }, { status: 404 });
    }
    await db.delete(friends).where(eq(friends.id, pair.id)).run();
    return NextResponse.json({ message: "Связь удалена" });
  } catch (error) {
    console.error("Friend remove error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}