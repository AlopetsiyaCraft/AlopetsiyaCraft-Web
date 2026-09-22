import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { photoAlbums, photos } from "@/lib/db/schema";

/** PATCH /api/albums/[id] {name} — переименовать альбом (владелец). */
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
    const album = await db
      .select()
      .from(photoAlbums)
      .where(eq(photoAlbums.id, parseInt(id, 10)))
      .get();
    if (!album) {
      return NextResponse.json({ error: "Альбом не найден" }, { status: 404 });
    }
    if (album.userId !== userId) {
      return NextResponse.json({ error: "Это чужой альбом" }, { status: 403 });
    }
    const body = await request.json();
    const name = (body?.name ?? "").toString().trim();
    if (!name || name.length > 60) {
      return NextResponse.json({ error: "Название от 1 до 60 символов" }, { status: 400 });
    }
    await db.update(photoAlbums).set({ name }).where(eq(photoAlbums.id, album.id)).run();
    return NextResponse.json({ message: "Альбом переименован" });
  } catch (error) {
    console.error("Album rename error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

/** DELETE /api/albums/[id] — удалить альбом (владелец). Фото остаются, но без альбома. */
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
    const album = await db
      .select()
      .from(photoAlbums)
      .where(eq(photoAlbums.id, parseInt(id, 10)))
      .get();
    if (!album) {
      return NextResponse.json({ error: "Альбом не найден" }, { status: 404 });
    }
    if (album.userId !== userId) {
      return NextResponse.json({ error: "Это чужой альбом" }, { status: 403 });
    }
    await db.update(photos).set({ albumId: null }).where(eq(photos.albumId, album.id)).run();
    await db.delete(photoAlbums).where(eq(photoAlbums.id, album.id)).run();
    return NextResponse.json({ message: "Альбом удалён" });
  } catch (error) {
    console.error("Album delete error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}