import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { unlink } from "fs/promises";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { photoComments, photoAlbums, photos, postPhotos, seasons, users } from "@/lib/db/schema";
import { photoRoot } from "@/lib/photos";

function assertOk(cond: unknown, message: string, status = 400): asserts cond {
  if (!cond) throw new ApiError(message, status);
}
class ApiError extends Error {
  constructor(public message: string, public status = 400) {
    super(message);
  }
}

/** PATCH /api/photos/[id] — правка метаданных (владелец): visibility, albumId, caption, seasonId. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }
    const userId = parseInt(session.user.id, 10);
    const { id } = await params;
    const photo = await db.select().from(photos).where(eq(photos.id, parseInt(id, 10))).get();
    assertOk(photo, "Фото не найдено", 404);
    assertOk(photo.userId === userId, "Это фото не ваше", 403);

    const body = await request.json();
    const { visibility, albumId, seasonId, caption } = body as {
      visibility?: "public" | "registered";
      albumId?: number | null;
      seasonId?: number;
      caption?: string | null;
    };

    const updates: Partial<typeof photos.$inferInsert> = {};

    if (visibility !== undefined) {
      assertOk(visibility === "public" || visibility === "registered", "Некорректная видимость");
      updates.visibility = visibility;
    }
    if (albumId !== undefined) {
      if (albumId === null) {
        updates.albumId = null;
      } else {
        const album = await db
          .select({ id: photoAlbums.id })
          .from(photoAlbums)
          .where(and(eq(photoAlbums.id, albumId), eq(photoAlbums.userId, userId)))
          .get();
        assertOk(album, "Альбом не найден или не принадлежит вам");
        updates.albumId = albumId;
      }
    }
    if (seasonId !== undefined) {
      const season = await db.select({ id: seasons.id }).from(seasons).where(eq(seasons.id, seasonId)).get();
      assertOk(season, "Сезон не найден");
      updates.seasonId = seasonId;
    }
    if (caption !== undefined) {
      updates.caption = (caption || "").trim().slice(0, 200) || null;
    }

    if (Object.keys(updates).length > 0) {
      await db.update(photos).set(updates).where(eq(photos.id, photo.id)).run();
    }
    return NextResponse.json({ message: "Фото обновлено" });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Photo patch error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

/** DELETE /api/photos/[id] — удаление (владелец или админ). */
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
    const photo = await db.select().from(photos).where(eq(photos.id, parseInt(id, 10))).get();
    assertOk(photo, "Фото не найдено", 404);

    const viewer = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .get();
    assertOk(photo.userId === userId || viewer?.role === "admin", "Нет прав на удаление", 403);

    await db.delete(photoComments).where(eq(photoComments.photoId, photo.id)).run();
    await db.delete(postPhotos).where(eq(postPhotos.photoId, photo.id)).run();
    await db.delete(photos).where(eq(photos.id, photo.id)).run();

    try {
      await unlink(photoRoot(photo.fileName));
    } catch {
      // файл уже отсутствует — не критично
    }

    return NextResponse.json({ message: "Фото удалено" });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Photo delete error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}