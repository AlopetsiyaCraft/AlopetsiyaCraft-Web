import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { audioTracks, discRequests, users } from "@/lib/db/schema";

/**
 * POST /api/audio/[id]/disc — создать заявку на пластинку.
 * Только владелец трека. Мод периодически забирает pending-заявки
 * (см. GET /api/discs/poll) и выдаёт игроку пластинку в инвентарь.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.name) {
    return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);

  const { id } = await params;
  const trackId = parseInt(id, 10);
  if (!Number.isFinite(trackId)) {
    return NextResponse.json({ error: "Неверный id трека" }, { status: 400 });
  }

  const track = await db
    .select({ id: audioTracks.id, userId: audioTracks.userId })
    .from(audioTracks)
    .where(eq(audioTracks.id, trackId))
    .limit(1)
    .get();

  if (!track) {
    return NextResponse.json({ error: "Трек не найден" }, { status: 404 });
  }

  if (track.userId !== userId) {
    return NextResponse.json(
      { error: "Пластинку можно сделать только из своего трека" },
      { status: 403 }
    );
  }

  // Ник должен совпадать с ником аккаунта (по нему мод найдёт игрока на сервере).
  const result = await db
    .insert(discRequests)
    .values({ userId, trackId, nickname: session.user.name })
    .returning({ id: discRequests.id })
    .get();

  return NextResponse.json({ requestId: result.id }, { status: 201 });
}