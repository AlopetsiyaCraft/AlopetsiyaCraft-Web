import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { postComments, users, wallPosts } from "@/lib/db/schema";
import type { PostCommentItem } from "@/lib/profile";

/** GET /api/wall/[id]/comments — комментарии к записи (авторизация). */
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
      authorNickname: users.nickname,
      authorId: postComments.userId,
    })
    .from(postComments)
    .leftJoin(users, eq(postComments.userId, users.id))
    .where(eq(postComments.postId, parseInt(id, 10)))
    .orderBy(asc(postComments.createdAt))
    .all();

  const items: PostCommentItem[] = rows.map((r) => ({
    id: r.id,
    postId: r.postId,
    text: r.text,
    createdAt: r.createdAt.getTime(),
    authorNickname: r.authorNickname ?? "unknown",
    viewerIsAuthor: r.authorId === viewerId,
  }));
  return NextResponse.json(items);
}

/** POST /api/wall/[id]/comments — добавить комментарий (авторизация). */
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

    const row = await db
      .insert(postComments)
      .values({ postId, userId: parseInt(session.user.id, 10), text })
      .returning()
      .get();

    const author = await db
      .select({ nickname: users.nickname })
      .from(users)
      .where(eq(users.id, row.userId))
      .get();

    const item: PostCommentItem = {
      id: row.id,
      postId: row.postId,
      text: row.text,
      createdAt: row.createdAt.getTime(),
      authorNickname: author?.nickname ?? "unknown",
      viewerIsAuthor: true,
    };
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("Post comment error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}