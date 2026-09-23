import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { audioTracks } from "@/lib/db/schema";
import { resolveAudioPath } from "@/lib/audio";

/**
 * GET /api/audio/[id]/cover — пиксельная обложка трека (16×16 PNG).
 * Публичный: используется в UI и в ресурспаке пластинок.
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

  const path = resolveAudioPath(String(track.userId), track.coverFileName);
  if (!path) {
    return NextResponse.json({ error: "Неверный путь" }, { status: 400 });
  }

  try {
    const data = await readFile(path);
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