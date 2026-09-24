import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { mkdirSync } from "fs";
import { writeFile } from "fs/promises";
import sharp from "sharp";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { photoAlbums, photos, seasons, users } from "@/lib/db/schema";
import {
  MAX_PHOTO_BYTES,
  PHOTO_POST_MAX,
  PHOTO_THUMB_MAX,
  generatePhotoFileName,
  isPhotoExt,
  photoPostFileName,
  photoRoot,
  photoThumbFileName,
} from "@/lib/photos";
import { photoCommentCounts, toPhotoItem } from "@/lib/photoRows";

/** Миниатюра фото: JPEG, не больше `max` по большей стороне, пропорции сохранены. */
async function makePhotoThumb(bytes: Buffer, max: number): Promise<Buffer> {
  return sharp(bytes)
    .rotate()
    .resize(max, max, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();
}

/**
 * GET /api/photos — список фото.
 * Параметры: userId (профиль), seasonId (галерея по сезону), albumId.
 * Анонимам (без сессии) отдаются только фото с visibility='public'.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  const sp = request.nextUrl.searchParams;
  const userId = sp.get("userId");
  const seasonId = sp.get("seasonId");
  const albumId = sp.get("albumId");

  const where = and(
    userId ? eq(photos.userId, parseInt(userId, 10)) : undefined,
    seasonId ? eq(photos.seasonId, parseInt(seasonId, 10)) : undefined,
    albumId ? eq(photos.albumId, parseInt(albumId, 10)) : undefined,
    !session?.user?.id ? eq(photos.visibility, "public") : undefined,
  );

  const rows = await db
    .select({
      id: photos.id,
      userId: photos.userId,
      seasonId: photos.seasonId,
      albumId: photos.albumId,
      visibility: photos.visibility,
      caption: photos.caption,
      createdAt: photos.createdAt,
      size: photos.size,
      originalName: photos.originalName,
      fileName: photos.fileName,
      authorNickname: users.nickname,
      albumName: photoAlbums.name,
      seasonNumber: seasons.number,
    })
    .from(photos)
    .leftJoin(users, eq(photos.userId, users.id))
    .leftJoin(photoAlbums, eq(photos.albumId, photoAlbums.id))
    .leftJoin(seasons, eq(photos.seasonId, seasons.id))
    .where(where)
    .orderBy(desc(photos.createdAt))
    .limit(200)
    .all();

  const ids = rows.map((r) => r.id);
  const countMap = await photoCommentCounts(ids);

  return NextResponse.json(rows.map((r) => toPhotoItem(r, countMap)));
}

/**
 * POST /api/photos — загрузка фото (multipart).
 * Поля: file, seasonId (обязательно), albumId (необязательно),
 * visibility ('public'|'registered'), caption.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }
    const userId = parseInt(session.user.id, 10);

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const seasonIdRaw = formData.get("seasonId") as string;
    const visibilityRaw = formData.get("visibility") as string;
    const albumIdRaw = formData.get("albumId") as string;
    const captionRaw = formData.get("caption") as string;

    if (!file || !seasonIdRaw) {
      return NextResponse.json(
        { error: "Файл и сезон обязательны (сезон обязателен — фото попадает в галерею сезона)" },
        { status: 400 }
      );
    }
    if (!isPhotoExt(file.name)) {
      return NextResponse.json({ error: "Только изображения: jpg, png, webp, gif" }, { status: 400 });
    }
    if (file.size > MAX_PHOTO_BYTES) {
      return NextResponse.json({ error: "Файл больше 12 МБ" }, { status: 400 });
    }

    const seasonId = parseInt(seasonIdRaw, 10);
    if (isNaN(seasonId)) {
      return NextResponse.json({ error: "Некорректный сезон" }, { status: 400 });
    }
    const season = await db.select({ id: seasons.id }).from(seasons).where(eq(seasons.id, seasonId)).get();
    if (!season) {
      return NextResponse.json({ error: "Сезон не найден" }, { status: 400 });
    }

    let albumId: number | null = null;
    if (albumIdRaw && albumIdRaw !== "0" && albumIdRaw !== "") {
      albumId = parseInt(albumIdRaw, 10);
      if (isNaN(albumId)) {
        return NextResponse.json({ error: "Некорректный альбом" }, { status: 400 });
      }
      const album = await db
        .select({ id: photoAlbums.id })
        .from(photoAlbums)
        .where(and(eq(photoAlbums.id, albumId), eq(photoAlbums.userId, userId)))
        .get();
      if (!album) {
        return NextResponse.json({ error: "Альбом не найден или не принадлежит вам" }, { status: 400 });
      }
    }

    const visibility = visibilityRaw === "registered" ? "registered" : "public";
    const caption = (captionRaw || "").trim().slice(0, 200) || null;

    const bytes = Buffer.from(await file.arrayBuffer());
    const fileName = generatePhotoFileName(file.name);
    const dir = photoRoot();
    mkdirSync(dir, { recursive: true });
    await writeFile(photoRoot(fileName), bytes);

    // Миниатюры (JPEG) лежат рядом с оригиналом под детерминированными
    // именами: -thumb.jpg для квадратиков/сеток, -post.jpg для вложений
    // постов (чуть выше разрешение — посты выводят фото крупнее).
    // Сбой генерации не роняет загрузку — UI умеет фолбэчиться на оригинал.
    const thumbBuf = await makePhotoThumb(bytes, PHOTO_THUMB_MAX).catch(() => null);
    const postBuf = await makePhotoThumb(bytes, PHOTO_POST_MAX).catch(() => null);
    await Promise.all([
      thumbBuf ? writeFile(photoRoot(photoThumbFileName(fileName)), thumbBuf) : Promise.resolve(),
      postBuf ? writeFile(photoRoot(photoPostFileName(fileName)), postBuf) : Promise.resolve(),
    ]);

    const row = await db
      .insert(photos)
      .values({
        userId,
        seasonId,
        albumId: albumId ?? null,
        fileName,
        originalName: file.name,
        size: bytes.length,
        visibility,
        caption,
      })
      .returning()
      .get();

    return NextResponse.json(
      {
        id: row.id,
        url: `/uploads/photos/${fileName}`,
        thumbUrl: `/uploads/photos/${photoThumbFileName(fileName)}`,
        postUrl: `/uploads/photos/${photoPostFileName(fileName)}`,
        message: "Фото загружено",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Photo upload error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}