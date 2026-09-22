import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { audioTracks, users } from "@/lib/db/schema";

/**
 * GET /api/audio — список треков.
 * - Без параметров: треки текущего пользователя (нужна авторизация).
 * - ?user=<ник>: публичная библиотека другого пользователя (для просмотра).
 */
export async function GET(request: NextRequest) {
  const session = await auth();

  const targetNick = request.nextUrl.searchParams.get("user");

  let userId: number;
  if (targetNick) {
    const owner = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.nickname, targetNick))
      .limit(1)
      .get();
    if (!owner) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }
    userId = owner.id;
  } else {
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }
    userId = parseInt(session.user.id, 10);
  }

  const rows = await db
    .select({
      id: audioTracks.id,
      title: audioTracks.title,
      artist: audioTracks.artist,
      size: audioTracks.size,
      createdAt: audioTracks.createdAt,
    })
    .from(audioTracks)
    .where(eq(audioTracks.userId, userId))
    .orderBy(desc(audioTracks.createdAt))
    .all();

  return NextResponse.json(
    rows.map((t) => ({
      id: t.id,
      title: t.title,
      artist: t.artist,
      size: t.size,
      createdAt: t.createdAt.getTime(),
      url: `/api/audio/${t.id}/file`,
    }))
  );
}