import { NextRequest, NextResponse } from "next/server";
import { asc, and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { postCommentLikes, postComments, users } from "@/lib/db/schema";
import type { CommentLikeUser } from "@/lib/profile";

/** POST /api/wall/[id]/comments/[commentId]/like — поставить/снять лайк (переключение). */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const session = await auth();
    const userId = session?.user?.id ? parseInt(session.user.id, 10) : null;
    if (!userId) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }
    const { id, commentId } = await params;
    const postId = parseInt(id, 10);
    const cid = parseInt(commentId, 10);

    const comment = await db
      .select({ id: postComments.id, postId: postComments.postId })
      .from(postComments)
      .where(eq(postComments.id, cid))
      .get();
    if (!comment || comment.postId !== postId) {
      return NextResponse.json({ error: "Комментарий не найден" }, { status: 404 });
    }

    const existing = await db
      .select({ id: postCommentLikes.id })
      .from(postCommentLikes)
      .where(and(eq(postCommentLikes.commentId, cid), eq(postCommentLikes.userId, userId)))
      .get();

    if (existing) {
      await db.delete(postCommentLikes).where(eq(postCommentLikes.id, existing.id));
    } else {
      await db.insert(postCommentLikes).values({ commentId: cid, userId });
    }

    const likes = await db
      .select({ nickname: users.nickname, skinUrl: users.skinUrl })
      .from(postCommentLikes)
      .innerJoin(users, eq(postCommentLikes.userId, users.id))
      .where(eq(postCommentLikes.commentId, cid))
      .orderBy(asc(postCommentLikes.createdAt))
      .all();

    const likers: CommentLikeUser[] = likes.map((l) => ({
      nickname: l.nickname ?? "unknown",
      skinUrl: l.skinUrl ?? null,
    }));
    return NextResponse.json({
      commentId: cid,
      liked: !existing,
      likeCount: likers.length,
      likedByMe: !existing,
      likers,
    });
  } catch (error) {
    console.error("Post comment like error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}