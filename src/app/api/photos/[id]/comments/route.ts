import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { photoComments, photos, users } from "@/lib/db/schema";
import type { PhotoCommentItem } from "@/lib/profile";

/**
 * GET /api/photos/[id]/comments — список комментариев к фото.
 * Анонимам комментарии не показываются (скрыты) — по решению для публичной галереи.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json([]);
  }
  const { id } = await params;
  const viewerId = parseInt(session.user.id, 10);

  const rows = await db
    .select({
      id: photoComments.id,
      photoId: photoComments.photoId,
      text: photoComments.text,
      createdAt: photoComments.createdAt,
      authorNickname: users.nickname,
      authorId: photoComments.userId,
    })
    .from(photoComments)
    .leftJoin(users, eq(photoComments.userId, users.id))
    .where(eq(photoComments.photoId, parseInt(id, 10)))
    .orderBy(asc(photoComments.createdAt))
    .all();

  const items: PhotoCommentItem[] = rows.map((r) => ({
    id: r.id,
    photoId: r.photoId,
    text: r.text,
    createdAt: r.createdAt.getTime(),
    authorNickname: r.authorNickname ?? "unknown",
    viewerIsAuthor: r.authorId === viewerId,
  }));
  return NextResponse.json(items);
}

/** POST /api/photos/[id]/comments — добавить комментарий (авторизация). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }
    const { id } = await params;
    const photoId = parseInt(id, 10);
    const exists = await db.select({ id: photos.id }).from(photos).where(eq(photos.id, photoId)).get();
    if (!exists) {
      return NextResponse.json({ error: "Фото не найдено" }, { status: 404 });
    }

    const body = await request.json();
    const text = (body?.text ?? "").toString().trim();
    if (!text || text.length > 500) {
      return NextResponse.json(
        { error: "Комментарий пуст или слишком длинный (максимум 500 символов)" },
        { status: 400 }
      );
    }

    const row = await db
      .insert(photoComments)
      .values({ photoId, userId: parseInt(session.user.id, 10), text })
      .returning()
      .get();

    const author = await db
      .select({ nickname: users.nickname })
      .from(users)
      .where(eq(users.id, row.userId))
      .get();

    const item: PhotoCommentItem = {
      id: row.id,
      photoId: row.photoId,
      text: row.text,
      createdAt: row.createdAt.getTime(),
      authorNickname: author?.nickname ?? "unknown",
      viewerIsAuthor: true,
    };
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("Photo comment error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}