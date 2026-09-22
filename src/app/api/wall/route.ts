import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { photos, postPhotos, wallPosts } from "@/lib/db/schema";
import { loadPosts } from "@/lib/wall";

/** GET /api/wall?userId=<id> — записи со стены пользователя (авторизация). */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
  }
  const userIdRaw = request.nextUrl.searchParams.get("userId");
  if (!userIdRaw || isNaN(parseInt(userIdRaw, 10))) {
    return NextResponse.json({ error: "userId обязателен" }, { status: 400 });
  }
  return NextResponse.json(await loadPosts(parseInt(userIdRaw, 10)));
}

/** POST /api/wall — опубликовать запись на СВОЕЙ стене. { text?, photoIds? } */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }
    const userId = parseInt(session.user.id, 10);
    const body = await request.json();
    const text = (body?.text ?? "").toString().trim().slice(0, 1000);
    const photoIds: number[] = Array.isArray(body?.photoIds)
      ? body.photoIds.map((x: number) => parseInt(String(x), 10)).filter((x: number) => !isNaN(x))
      : [];

    if (!text && photoIds.length === 0) {
      return NextResponse.json(
        { error: "Запись пуста — напишите текст или прикрепите фото" },
        { status: 400 }
      );
    }
    if (photoIds.length > 6) {
      return NextResponse.json({ error: "Можно прикрепить не больше 6 фото" }, { status: 400 });
    }
    if (photoIds.length > 0) {
      const owned = await db
        .select({ id: photos.id })
        .from(photos)
        .where(and(inArray(photos.id, photoIds), eq(photos.userId, userId)))
        .all();
      if (owned.length !== photoIds.length) {
        return NextResponse.json({ error: "Можно прикреплять только свои фото" }, { status: 403 });
      }
    }

    const post = await db
      .insert(wallPosts)
      .values({ userId, text })
      .returning()
      .get();

    if (photoIds.length > 0) {
      await db
        .insert(postPhotos)
        .values(photoIds.map((pid) => ({ postId: post.id, photoId: pid })))
        .run();
    }

    const postItems = await loadPosts(userId);
    return NextResponse.json(postItems[0] ?? null, { status: 201 });
  } catch (error) {
    console.error("Wall post error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}