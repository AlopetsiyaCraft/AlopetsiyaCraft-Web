import { NextRequest, NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { getStaffUser } from "@/lib/admin";
import { db } from "@/lib/db";
import {
  photoCommentLikes,
  photoComments,
  photos,
  postCommentLikes,
  postComments,
  postPhotos,
  wallPosts,
} from "@/lib/db/schema";

async function deletePostCommentTree(id: number) {
  const children = await db
    .select({ id: postComments.id })
    .from(postComments)
    .where(eq(postComments.parentId, id))
    .all();
  for (const child of children) {
    await deletePostCommentTree(child.id);
  }
  await db.delete(postCommentLikes).where(eq(postCommentLikes.commentId, id)).run();
  await db.delete(postComments).where(eq(postComments.id, id)).run();
}

async function deletePhotoCommentTree(id: number) {
  const children = await db
    .select({ id: photoComments.id })
    .from(photoComments)
    .where(eq(photoComments.parentId, id))
    .all();
  for (const child of children) {
    await deletePhotoCommentTree(child.id);
  }
  await db.delete(photoCommentLikes).where(eq(photoCommentLikes.commentId, id)).run();
  await db.delete(photoComments).where(eq(photoComments.id, id)).run();
}

/**
 * POST /api/admin/content/delete { type, id }
 * type: wall | photo | post_comment | photo_comment.
 * Доступно админам и модераторам. Файлы фото на диске не трогаем.
 */
export async function POST(request: NextRequest) {
  const staff = await getStaffUser();
  if (!staff) {
    return NextResponse.json({ error: "Нет прав" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const type = body?.type;
  const id = Number(body?.id);
  if (!["wall", "photo", "post_comment", "photo_comment"].includes(type)) {
    return NextResponse.json({ error: "Некорректный тип" }, { status: 400 });
  }
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Некорректный id" }, { status: 400 });
  }

  if (type === "wall") {
    const comments = await db
      .select({ id: postComments.id })
      .from(postComments)
      .where(eq(postComments.postId, id))
      .all();
    const ids = comments.map((c) => c.id);
    if (ids.length > 0) {
      await db
        .delete(postCommentLikes)
        .where(inArray(postCommentLikes.commentId, ids))
        .run();
    }
    await db.delete(postComments).where(eq(postComments.postId, id)).run();
    await db.delete(postPhotos).where(eq(postPhotos.postId, id)).run();
    await db.delete(wallPosts).where(eq(wallPosts.id, id)).run();
    return NextResponse.json({ message: "Запись удалена" });
  }

  if (type === "photo") {
    const comments = await db
      .select({ id: photoComments.id })
      .from(photoComments)
      .where(eq(photoComments.photoId, id))
      .all();
    const ids = comments.map((c) => c.id);
    if (ids.length > 0) {
      await db
        .delete(photoCommentLikes)
        .where(inArray(photoCommentLikes.commentId, ids))
        .run();
    }
    await db.delete(photoComments).where(eq(photoComments.photoId, id)).run();
    await db.delete(postPhotos).where(eq(postPhotos.photoId, id)).run();
    await db.delete(photos).where(eq(photos.id, id)).run();
    return NextResponse.json({ message: "Фото удалено" });
  }

  if (type === "post_comment") {
    await deletePostCommentTree(id);
    return NextResponse.json({ message: "Комментарий удалён" });
  }

  await deletePhotoCommentTree(id);
  return NextResponse.json({ message: "Комментарий удалён" });
}
