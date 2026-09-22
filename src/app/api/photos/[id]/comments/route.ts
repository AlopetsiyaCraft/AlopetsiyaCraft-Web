import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { photoComments, photos, users } from "@/lib/db/schema";
import type { PhotoCommentItem } from "@/lib/profile";

const authorAlias = alias(users, "author");
const replyUserAlias = alias(users, "reply_user");
const parentAlias = alias(photoComments, "parent");

/**
 * GET /api/photos/[id]/comments — комментарии к фото (плоский список + parentId).
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
      authorId: photoComments.userId,
      authorNickname: authorAlias.nickname,
      parentId: photoComments.parentId,
      replyToNickname: replyUserAlias.nickname,
    })
    .from(photoComments)
    .leftJoin(authorAlias, eq(photoComments.userId, authorAlias.id))
    .leftJoin(parentAlias, eq(photoComments.parentId, parentAlias.id))
    .leftJoin(replyUserAlias, eq(parentAlias.userId, replyUserAlias.id))
    .where(eq(photoComments.photoId, parseInt(id, 10)))
    .orderBy(asc(photoComments.createdAt), asc(photoComments.id))
    .all();

  const items: PhotoCommentItem[] = rows.map((r) => ({
    id: r.id,
    photoId: r.photoId,
    text: r.text,
    createdAt: r.createdAt.getTime(),
    authorId: r.authorId,
    authorNickname: r.authorNickname ?? "unknown",
    parentId: r.parentId ?? null,
    replyToNickname: r.replyToNickname ?? null,
    viewerIsAuthor: r.authorId === viewerId,
  }));
  return NextResponse.json(items);
}

/** POST /api/photos/[id]/comments — добавить комментарий (авторизация). parentId — ответ на комментарий. */
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

    let parentId: number | null = null;
    if (body?.parentId != null) {
      parentId = parseInt(body.parentId, 10);
      if (isNaN(parentId) || parentId <= 0) {
        return NextResponse.json({ error: "Некорректный ответ на комментарий" }, { status: 400 });
      }
      const parent = await db
        .select({ id: photoComments.id, photoId: photoComments.photoId })
        .from(photoComments)
        .where(eq(photoComments.id, parentId))
        .get();
      if (!parent || parent.photoId !== photoId) {
        return NextResponse.json({ error: "Комментарий-ответ не найден" }, { status: 404 });
      }
    }

    const row = await db
      .insert(photoComments)
      .values({ photoId, userId: parseInt(session.user.id, 10), text, parentId })
      .returning()
      .get();

    const [author, replyTo] = await Promise.all([
      db.select({ nickname: users.nickname }).from(users).where(eq(users.id, row.userId)).get(),
      parentId != null
        ? db
            .select({ nickname: users.nickname })
            .from(photoComments)
            .innerJoin(users, eq(photoComments.userId, users.id))
            .where(eq(photoComments.id, parentId))
            .get()
        : Promise.resolve(undefined),
    ]);

    const item: PhotoCommentItem = {
      id: row.id,
      photoId: row.photoId,
      text: row.text,
      createdAt: row.createdAt.getTime(),
      authorId: row.userId,
      authorNickname: author?.nickname ?? "unknown",
      parentId: row.parentId ?? null,
      replyToNickname: replyTo?.nickname ?? null,
      viewerIsAuthor: true,
    };
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("Photo comment error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}