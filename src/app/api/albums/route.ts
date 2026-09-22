import { NextRequest, NextResponse } from "next/server";
import { count, desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { photoAlbums, photos } from "@/lib/db/schema";
import type { AlbumsListItem } from "@/lib/profile";

/**
 * GET /api/albums?userId=<id> — альбомы пользователя (для выбора/фильтра).
 * POST /api/albums {name} — создать альбом (авторизация).
 */
export async function GET(request: NextRequest) {
  const userIdRaw = request.nextUrl.searchParams.get("userId");
  let userId: number;
  if (userIdRaw) {
    userId = parseInt(userIdRaw, 10);
    if (isNaN(userId)) {
      return NextResponse.json({ error: "Некорректный userId" }, { status: 400 });
    }
  } else {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }
    userId = parseInt(session.user.id, 10);
  }

  const rows = await db
    .select({
      id: photoAlbums.id,
      name: photoAlbums.name,
      createdAt: photoAlbums.createdAt,
      photoCount: count(photos.id).as("photoCount"),
    })
    .from(photoAlbums)
    .leftJoin(photos, eq(photos.albumId, photoAlbums.id))
    .where(eq(photoAlbums.userId, userId))
    .groupBy(photoAlbums.id)
    .orderBy(desc(photoAlbums.createdAt))
    .all();

  const items: AlbumsListItem[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    photoCount: r.photoCount,
    createdAt: r.createdAt.getTime(),
  }));
  return NextResponse.json(items);
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }
    const body = await request.json();
    const name = (body?.name ?? "").toString().trim();
    if (!name || name.length > 60) {
      return NextResponse.json(
        { error: "Название альбома от 1 до 60 символов" },
        { status: 400 }
      );
    }
    const albumCount = await db
      .select({ c: count(photoAlbums.id).as("c") })
      .from(photoAlbums)
      .where(eq(photoAlbums.userId, parseInt(session.user.id, 10)))
      .get();
    if ((albumCount?.c ?? 0) >= 30) {
      return NextResponse.json({ error: "Максимум 30 альбомов" }, { status: 400 });
    }
    const row = await db
      .insert(photoAlbums)
      .values({ userId: parseInt(session.user.id, 10), name })
      .returning()
      .get();
    return NextResponse.json({ id: row.id, name: row.name }, { status: 201 });
  } catch (error) {
    console.error("Album create error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}