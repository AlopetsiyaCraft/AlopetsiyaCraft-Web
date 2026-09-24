import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile } from "fs/promises";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { audioTracks } from "@/lib/db/schema";
import { coverFilePath, coverThumbFilePath } from "@/lib/audio";

/**
 * GET /api/audio/[id]/cover/thumb — миниатюра обложки (128×128 PNG).
 * Публичный: используется в списках песен и на стене, чтобы не тянуть
 * полноразмерную обложку ради маленькой картинки.
 *
 * Для старых треков (загруженных до появления миниатюр) генерирует
 * миниатюру лениво из оригинала и сохраняет рядом — повторные запросы
 * отдают файл с диска.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const trackId = parseInt(id, 10);

  if (!Number.isFinite(trackId)) {
    return NextResponse.json({ error: "Неверный id трека" }, { status: 400 });
  }

  const track = await db
    .select({
      userId: audioTracks.userId,
      coverFileName: audioTracks.coverFileName,
    })
    .from(audioTracks)
    .where(eq(audioTracks.id, trackId))
    .limit(1)
    .get();

  if (!track) {
    return NextResponse.json({ error: "Трек не найден" }, { status: 404 });
  }

  if (!track.coverFileName) {
    return NextResponse.json({ error: "У трека нет обложки" }, { status: 404 });
  }

  const thumbPath = coverThumbFilePath(track.userId, track.coverFileName);

  // Старый трек без миниатюры на диске — пробуем сгенерировать из оригинала.
  try {
    await readFile(thumbPath);
  } catch {
    const coverPath = coverFilePath(track.userId, track.coverFileName);
    try {
      const original = await readFile(coverPath);
      const thumb = await sharp(original).resize(128, 128, { fit: "cover" }).png().toBuffer();
      await writeFile(thumbPath, thumb);
    } catch {
      // Не получилось сделать миниатюру — отдаём оригинал: он тоже валиден.
      try {
        const data = await readFile(coverPath);
        return new Response(data, {
          headers: {
            "Content-Type": "image/png",
            "Content-Length": String(data.byteLength),
            "Cache-Control": "public, max-age=86400",
          },
        });
      } catch {
        return NextResponse.json({ error: "Файл не найден" }, { status: 404 });
      }
    }
  }

  try {
    const data = await readFile(thumbPath);
    return new Response(data, {
      headers: {
        "Content-Type": "image/png",
        "Content-Length": String(data.byteLength),
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "Файл не найден" }, { status: 404 });
  }
}