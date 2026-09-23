import { NextRequest, NextResponse } from "next/server";
import { unlink } from "fs/promises";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { audioTracks, discRequests } from "@/lib/db/schema";
import { resolveAudioPath } from "@/lib/audio";

/**
 * DELETE /api/audio/[id] — удаление трека (только владелец).
 * Незавершённые заявки на пластинку по этому треку помечаются неудачными.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);

  const { id } = await params;
  const trackId = parseInt(id, 10);
  if (!Number.isFinite(trackId)) {
    return NextResponse.json({ error: "Неверный id трека" }, { status: 400 });
  }

  const track = await db
    .select({
      id: audioTracks.id,
      userId: audioTracks.userId,
      fileName: audioTracks.fileName,
      coverFileName: audioTracks.coverFileName,
    })
    .from(audioTracks)
    .where(eq(audioTracks.id, trackId))
    .limit(1)
    .get();

  if (!track) {
    return NextResponse.json({ error: "Трек не найден" }, { status: 404 });
  }

  if (track.userId !== userId) {
    return NextResponse.json({ error: "Нельзя удалить чужой трек" }, { status: 403 });
  }

  // Помечаем незавершённые заявки (чтобы поллящий UI увидел причину),
  // затем удаляем все заявки по треку — иначе FOREIGN KEY не даст удалить сам трек.
  await db
    .update(discRequests)
    .set({ status: "failed", error: "Трек был удалён", completedAt: new Date() })
    .where(and(eq(discRequests.trackId, trackId), eq(discRequests.status, "pending")))
    .run();

  await db.delete(discRequests).where(eq(discRequests.trackId, trackId)).run();

  await db.delete(audioTracks).where(eq(audioTracks.id, trackId)).run();

  const path = resolveAudioPath(String(track.userId), track.fileName);
  if (path) {
    unlink(path).catch(() => {});
  }
  if (track.coverFileName) {
    const coverPath = resolveAudioPath(String(track.userId), track.coverFileName);
    if (coverPath) {
      unlink(coverPath).catch(() => {});
    }
  }

  return NextResponse.json({ message: "Трек удалён" });
}