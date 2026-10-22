import { NextRequest, NextResponse } from "next/server";
import { stat } from "fs/promises";
import { createReadStream } from "fs";
import { Readable } from "stream";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { audioTracks } from "@/lib/db/schema";
import { resolveAudioPath } from "@/lib/audio";

/**
 * GET /api/audio/[id]/file — отдаёт mp3 трека.
 * Публичный: библиотеки можно просматривать, а с этого же URL волков
 * SVC-сервер (на той же машине) тянет аудио для проигрывания пластинок.
 *
 * Поддерживает HTTP Range (206 Partial Content) — без этого браузер не может
 * перематывать трек: он запрашивает кусок файла с нужной секунды.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const trackId = parseInt(id, 10);

  if (!Number.isFinite(trackId)) {
    return NextResponse.json({ error: "Неверный id трека" }, { status: 400 });
  }

  const track = await db
    .select({ userId: audioTracks.userId, fileName: audioTracks.fileName })
    .from(audioTracks)
    .where(eq(audioTracks.id, trackId))
    .limit(1)
    .get();

  if (!track) {
    return NextResponse.json({ error: "Трек не найден" }, { status: 404 });
  }

  const path = resolveAudioPath(String(track.userId), track.fileName);
  if (!path) {
    return NextResponse.json({ error: "Неверный путь" }, { status: 400 });
  }

  let size: number;
  try {
    size = (await stat(path)).size;
  } catch {
    return NextResponse.json({ error: "Файл не найден" }, { status: 404 });
  }

  const headers: Record<string, string> = {
    "Content-Type": "audio/mpeg",
    "Cache-Control": "public, max-age=86400",
    "Content-Disposition": 'inline; filename="track.mp3"',
    "Accept-Ranges": "bytes",
  };

  const range = request.headers.get("range");
  const match = range ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null;

  if (match) {
    let start: number;
    let end: number;

    if (!match[1]) {
      // Суффиксный диапазон: bytes=-500 — последние 500 байт.
      const suffix = parseInt(match[2] || "0", 10);
      if (!Number.isFinite(suffix) || suffix <= 0) {
        return new NextResponse(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${size}` },
        });
      }
      start = Math.max(size - suffix, 0);
      end = size - 1;
    } else {
      start = parseInt(match[1], 10);
      end = match[2] ? parseInt(match[2], 10) : size - 1;
    }

    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start > end ||
      start >= size
    ) {
      return new NextResponse(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${size}` },
      });
    }

    end = Math.min(end, size - 1);

    const stream = createReadStream(path, { start, end });
    return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
      status: 206,
      headers: {
        ...headers,
        "Content-Length": String(end - start + 1),
        "Content-Range": `bytes ${start}-${end}/${size}`,
      },
    });
  }

  const stream = createReadStream(path);
  return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
    headers: {
      ...headers,
      "Content-Length": String(size),
    },
  });
}
