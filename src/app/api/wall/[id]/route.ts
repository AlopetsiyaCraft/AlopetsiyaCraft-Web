import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { postComments, postPhotos, users, wallPosts } from "@/lib/db/schema";

/** DELETE /api/wall/[id] — удалить запись (автор или админ). */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }
    const userId = parseInt(session.user.id, 10);
    const { id } = await params;
    const post = await db.select().from(wallPosts).where(eq(wallPosts.id, parseInt(id, 10))).get();
    if (!post) {
      return NextResponse.json({ error: "Запись не найдена" }, { status: 404 });
    }
    const viewer = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .get();
    if (post.userId !== userId && viewer?.role !== "admin") {
      return NextResponse.json({ error: "Нет прав на удаление" }, { status: 403 });
    }

    await db.delete(postComments).where(eq(postComments.postId, post.id)).run();
    await db.delete(postPhotos).where(eq(postPhotos.postId, post.id)).run();
    await db.delete(wallPosts).where(eq(wallPosts.id, post.id)).run();
    return NextResponse.json({ message: "Запись удалена" });
  } catch (error) {
    console.error("Wall delete error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}