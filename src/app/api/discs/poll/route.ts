import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { audioTracks, discRequests } from "@/lib/db/schema";
import { checkBridgeKey } from "@/lib/bridge";
import { trackFileUrl } from "@/lib/audio";

/**
 * GET /api/discs/poll — точка опроса для игрового мода (x-api-key).
 * Возвращает все незавершённые заявки на пластинки вместе с данными
 * трека и URL файла (тоже с внутреннего сайта; SVC-сервер тянет аудио
 * с него сам, клиенты этот URL не видят).
 */
export async function GET(request: NextRequest) {
  if (!checkBridgeKey(request.headers.get("x-api-key"))) {
    return NextResponse.json({ error: "Неверный ключ API" }, { status: 401 });
  }

  const rows = await db
    .select({
      id: discRequests.id,
      nickname: discRequests.nickname,
      trackId: discRequests.trackId,
      title: audioTracks.title,
      artist: audioTracks.artist,
    })
    .from(discRequests)
    .innerJoin(audioTracks, eq(discRequests.trackId, audioTracks.id))
    .where(eq(discRequests.status, "pending"))
    .orderBy(asc(discRequests.id))
    .all();

  return NextResponse.json({
    requests: rows.map((r) => ({
      id: r.id,
      nickname: r.nickname,
      trackId: r.trackId,
      title: r.title,
      artist: r.artist,
      fileUrl: trackFileUrl(r.trackId),
    })),
  });
}