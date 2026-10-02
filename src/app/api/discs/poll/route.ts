import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { stat } from "fs/promises";
import { db } from "@/lib/db";
import { audioTracks, discRequests } from "@/lib/db/schema";
import { checkBridgeKey } from "@/lib/bridge";
import { trackFileUrl, resolveAudioPath } from "@/lib/audio";

/**
 * Ссылка на обложку трека с версией в URL.
 *
 * Зачем версия: путь `/api/audio/<id>/cover` не меняется, когда владелец
 * заменяет картинку, а ответ отдаётся с `Cache-Control: max-age=86400`.
 * Мод получал ту же ссылку, скачивал из кэша старую картинку и рисовал на
 * пластинке прежнюю обложку до перезахода. Время изменения файла делает ссылку
 * новой при каждой замене картинки — клиент скачивает свежую.
 */
async function coverUrlWithVersion(userId: number, trackId: number, coverFileName: string | null) {
  if (!coverFileName) return null;
  const path = resolveAudioPath(String(userId), coverFileName);
  if (!path) return `/api/audio/${trackId}/cover`;
  try {
    const info = await stat(path);
    return `/api/audio/${trackId}/cover?v=${Math.floor(info.mtimeMs)}`;
  } catch {
    return `/api/audio/${trackId}/cover`;
  }
}

/**
 * GET /api/discs/poll — точка опроса для игрового мода (x-api-key).
 * Возвращает все незавершённые заявки на пластинки вместе с данными
 * трека и URL файла (тоже с внутреннего сайта; SVC-сервер тянет аудио
 * с него сам, клиенты этот URL не видят).
 *
 * Ресурспак здесь больше не собирается: обложки динамические — клиент
 * качает картинку сам по `coverUrl` из данных предмета. Поля
 * `resourcePack*` возвращаются пустыми, чтобы старые сборки мода молча
 * пропускали отправку пака.
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
      userId: audioTracks.userId,
      title: audioTracks.title,
      artist: audioTracks.artist,
      coverFileName: audioTracks.coverFileName,
    })
    .from(discRequests)
    .innerJoin(audioTracks, eq(discRequests.trackId, audioTracks.id))
    .where(eq(discRequests.status, "pending"))
    .orderBy(asc(discRequests.id))
    .all();

  const requests = await Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      nickname: r.nickname,
      trackId: r.trackId,
      title: r.title,
      artist: r.artist,
      fileUrl: trackFileUrl(r.trackId),
      coverUrl: await coverUrlWithVersion(r.userId, r.trackId, r.coverFileName),
    }))
  );

  return NextResponse.json({
    requests,
    resourcePackUrl: "",
    resourcePackHash: "",
    resourcePackTrackCount: 0,
  });
}
