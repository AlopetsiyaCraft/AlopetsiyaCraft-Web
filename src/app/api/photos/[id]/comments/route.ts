import { NextRequest, NextResponse } from "next/server";
import { asc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { photoCommentLikes, photoComments, photos, users } from "@/lib/db/schema";
import type { PhotoCommentItem } from "@/lib/profile";

const authorAlias = alias(users, "author");
const replyUserAlias = alias(users, "reply_user");
const parentAlias = alias(photoComments, "parent");

/**
 * GET /api/photos/[id]/comments — комментарии к фото (плоский список + parentId + лайки).
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
      authorSkinUrl: authorAlias.skinUrl,
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

  // лайки одним запросом
  const ids = rows.map((r) => r.id);
  const likesByComment = new Map<
    number,
    Array<{ userId: number; nickname: string; skinUrl: string | null }>
  >();
  if (ids.length > 0) {
    const likes = await db
      .select({
        commentId: photoCommentLikes.commentId,
        userId: photoCommentLikes.userId,
        nickname: users.nickname,
        skinUrl: users.skinUrl,
      })
      .from(photoCommentLikes)
      .innerJoin(users, eq(photoCommentLikes.userId, users.id))
      .where(inArray(photoCommentLikes.commentId, ids))
      .all();
    for (const lk of likes) {
      const cur = likesByComment.get(lk.commentId) ?? [];
      cur.push({ userId: lk.userId, nickname: lk.nickname ?? "unknown", skinUrl: lk.skinUrl ?? null });
      likesByComment.set(lk.commentId, cur);
    }
  }

  const items: PhotoCommentItem[] = rows.map((r) => {
    const likers = likesByComment.get(r.id) ?? [];
    return {
      id: r.id,
      photoId: r.photoId,
      text: r.text,
      createdAt: r.createdAt.getTime(),
      authorId: r.authorId,
      authorNickname: r.authorNickname ?? "unknown",
      authorSkinUrl: r.authorSkinUrl ?? null,
      parentId: r.parentId ?? null,
      replyToNickname: r.replyToNickname ?? null,
      viewerIsAuthor: r.authorId === viewerId,
      likeCount: likers.length,
      likedByMe: likers.some((l) => l.userId === viewerId),
      likers: likers.map((l) => ({ nickname: l.nickname, skinUrl: l.skinUrl })),
    };
  });
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
      db.select({ nickname: users.nickname, skinUrl: users.skinUrl }).from(users).where(eq(users.id, row.userId)).get(),
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
      authorSkinUrl: author?.skinUrl ?? null,
      parentId: row.parentId ?? null,
      replyToNickname: replyTo?.nickname ?? null,
      viewerIsAuthor: true,
      likeCount: 0,
      likedByMe: false,
      likers: [],
    };
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("Photo comment error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}