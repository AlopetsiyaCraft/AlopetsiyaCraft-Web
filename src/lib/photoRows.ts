import { count, inArray } from "drizzle-orm";
import { db } from "./db";
import { photoComments } from "./db/schema";
import { photoPostUrl, photoThumbUrl, photoUrl } from "./photos";
import type { PhotoItem } from "./profile";

/** Строка-результат join-запроса по фото (photo + автор + альбом + сезон). */
export interface PhotoRow {
  id: number;
  userId: number;
  seasonId: number;
  albumId: number | null;
  visibility: "public" | "registered";
  caption: string | null;
  createdAt: Date;
  size: number;
  originalName: string;
  fileName: string;
  authorNickname: string | null;
  albumName: string | null;
  seasonNumber: number | null;
}

/**
 * Превращает строку БД в готовый объект для клиента.
 * countMap: photoId -> число комментариев (по умолчанию 0).
 */
export function toPhotoItem(row: PhotoRow, countMap?: Map<number, number>): PhotoItem {
  return {
    id: row.id,
    userId: row.userId,
    seasonId: row.seasonId,
    albumId: row.albumId,
    visibility: row.visibility,
    caption: row.caption,
    createdAt: row.createdAt.getTime(),
    size: row.size,
    originalName: row.originalName,
    url: photoUrl(row.fileName),
    thumbUrl: photoThumbUrl(row.fileName),
    postUrl: photoPostUrl(row.fileName),
    authorNickname: row.authorNickname ?? "unknown",
    albumName: row.albumName,
    seasonNumber: row.seasonNumber,
    commentCount: countMap?.get(row.id) ?? 0,
  };
}

/** Карта photoId -> число комментариев для списка фото. */
export async function photoCommentCounts(photoIds: number[]): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  if (photoIds.length === 0) return map;
  const rows = await db
    .select({ photoId: photoComments.photoId, c: count(photoComments.id).as("c") })
    .from(photoComments)
    .where(inArray(photoComments.photoId, photoIds))
    .groupBy(photoComments.photoId)
    .all();
  rows.forEach((r) => map.set(r.photoId, r.c));
  return map;
}