import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { audioTracks, discRequests, users } from "@/lib/db/schema";
import { DISC_PRICE_BLD } from "@/lib/currency";

/**
 * POST /api/audio/[id]/disc — создать заявку на пластинку.
 * Только владелец трека. Мод периодически забирает pending-заявки
 * (см. GET /api/discs/poll) и выдаёт игроку пластинку в инвентарь.
 * Заказ платный: списывается DISC_PRICE_BLD болдов (возврат при неудаче —
 * см. POST /api/discs/result).
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

  // Пластинка платная: проверяем болды до создания заявки, списываем сразу.
  const me = await db
    .select({ bld: users.bld })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  if (!me || (me.bld ?? 0) < DISC_PRICE_BLD) {
    return NextResponse.json(
      { error: `Недостаточно болдов: пластинка стоит ${DISC_PRICE_BLD} BLD` },
      { status: 402 }
    );
  }
  await db
    .update(users)
    .set({ bld: sql`bld - ${DISC_PRICE_BLD}` })
    .where(eq(users.id, userId))
    .run();

  // Ник должен совпадать с ником аккаунта (по нему мод найдёт игрока на сервере).
  const result = await db
    .insert(discRequests)
    .values({ userId, trackId, nickname: session.user.name })
    .returning({ id: discRequests.id })
    .get();

  return NextResponse.json({ requestId: result.id }, { status: 201 });
}