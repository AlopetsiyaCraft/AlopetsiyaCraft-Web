import { NextRequest, NextResponse } from "next/server";
import { asc, and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { photoCommentLikes, photoComments, users } from "@/lib/db/schema";
import type { CommentLikeUser } from "@/lib/profile";

/** POST /api/photos/[id]/comments/[commentId]/like — поставить/снять лайк (переключение). */
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
    const photoId = parseInt(id, 10);
    const cid = parseInt(commentId, 10);

    const comment = await db
      .select({ id: photoComments.id, photoId: photoComments.photoId })
      .from(photoComments)
      .where(eq(photoComments.id, cid))
      .get();
    if (!comment || comment.photoId !== photoId) {
      return NextResponse.json({ error: "Комментарий не найден" }, { status: 404 });
    }

    const existing = await db
      .select({ id: photoCommentLikes.id })
      .from(photoCommentLikes)
      .where(and(eq(photoCommentLikes.commentId, cid), eq(photoCommentLikes.userId, userId)))
      .get();

    if (existing) {
      await db.delete(photoCommentLikes).where(eq(photoCommentLikes.id, existing.id));
    } else {
      await db.insert(photoCommentLikes).values({ commentId: cid, userId });
    }

    const likes = await db
      .select({ nickname: users.nickname, skinUrl: users.skinUrl })
      .from(photoCommentLikes)
      .innerJoin(users, eq(photoCommentLikes.userId, users.id))
      .where(eq(photoCommentLikes.commentId, cid))
      .orderBy(asc(photoCommentLikes.createdAt))
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
    console.error("Photo comment like error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}