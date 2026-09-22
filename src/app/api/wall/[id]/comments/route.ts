import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { postComments, users, wallPosts } from "@/lib/db/schema";
import type { PostCommentItem } from "@/lib/profile";

const authorAlias = alias(users, "author");
const replyUserAlias = alias(users, "reply_user");
const parentAlias = alias(postComments, "parent");

/** GET /api/wall/[id]/comments — комментарии к записи (плоский список + parentId). */
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
      id: postComments.id,
      postId: postComments.postId,
      text: postComments.text,
      createdAt: postComments.createdAt,
      authorId: postComments.userId,
      authorNickname: authorAlias.nickname,
      parentId: postComments.parentId,
      replyToNickname: replyUserAlias.nickname,
    })
    .from(postComments)
    .leftJoin(authorAlias, eq(postComments.userId, authorAlias.id))
    .leftJoin(parentAlias, eq(postComments.parentId, parentAlias.id))
    .leftJoin(replyUserAlias, eq(parentAlias.userId, replyUserAlias.id))
    .where(eq(postComments.postId, parseInt(id, 10)))
    .orderBy(asc(postComments.createdAt), asc(postComments.id))
    .all();

  const items: PostCommentItem[] = rows.map((r) => ({
    id: r.id,
    postId: r.postId,
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

/** POST /api/wall/[id]/comments — добавить комментарий (авторизация). parentId — ответ на комментарий. */
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
    const postId = parseInt(id, 10);
    const exists = await db.select({ id: wallPosts.id }).from(wallPosts).where(eq(wallPosts.id, postId)).get();
    if (!exists) {
      return NextResponse.json({ error: "Запись не найдена" }, { status: 404 });
    }

    const body = await request.json();
    const text = (body?.text ?? "").toString().trim();
    if (!text || text.length > 500) {
      return NextResponse.json({ error: "Комментарий пуст или слишком длинный" }, { status: 400 });
    }

    let parentId: number | null = null;
    if (body?.parentId != null) {
      parentId = parseInt(body.parentId, 10);
      if (isNaN(parentId) || parentId <= 0) {
        return NextResponse.json({ error: "Некорректный ответ на комментарий" }, { status: 400 });
      }
      const parent = await db
        .select({ id: postComments.id, postId: postComments.postId })
        .from(postComments)
        .where(eq(postComments.id, parentId))
        .get();
      if (!parent || parent.postId !== postId) {
        return NextResponse.json({ error: "Комментарий-ответ не найден" }, { status: 404 });
      }
    }

    const row = await db
      .insert(postComments)
      .values({ postId, userId: parseInt(session.user.id, 10), text, parentId })
      .returning()
      .get();

    const [author, replyTo] = await Promise.all([
      db.select({ nickname: users.nickname }).from(users).where(eq(users.id, row.userId)).get(),
      parentId != null
        ? db
            .select({ nickname: users.nickname })
            .from(postComments)
            .innerJoin(users, eq(postComments.userId, users.id))
            .where(eq(postComments.id, parentId))
            .get()
        : Promise.resolve(undefined),
    ]);

    const item: PostCommentItem = {
      id: row.id,
      postId: row.postId,
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
    console.error("Post comment error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}