import { and, count, desc, eq, inArray, or } from "drizzle-orm";
import { db } from "./db";
import { audioTracks, friends, photos, users } from "./db/schema";

/** Превью трека для блока «Аудио» на стене (VK-стиль). */
export interface AudioPreviewItem {
  id: number;
  title: string;
  artist: string | null;
  createdAt: number;
  coverUrl: string | null;
}

/** Превью фото для блока «Фото» на стене (VK-стиль). */
export interface PhotoPreviewItem {
  id: number;
  url: string;
  caption: string | null;
  createdAt: number;
}

/** Превью друга для блока «Друзья» на стене (VK-стиль). */
export interface FriendPreviewItem {
  id: number;
  nickname: string;
  skinUrl: string | null;
  since: number;
}

/** Первые `limit` треков пользователя (новые сверху). */
export async function loadAudioPreview(userId: number, limit = 5): Promise<AudioPreviewItem[]> {
  const rows = await db
    .select({
      id: audioTracks.id,
      title: audioTracks.title,
      artist: audioTracks.artist,
      coverFileName: audioTracks.coverFileName,
      createdAt: audioTracks.createdAt,
    })
    .from(audioTracks)
    .where(eq(audioTracks.userId, userId))
    .orderBy(desc(audioTracks.createdAt))
    .limit(limit)
    .all();

  return rows.map((t) => ({
    id: t.id,
    title: t.title,
    artist: t.artist,
    createdAt: t.createdAt.getTime(),
    coverUrl: t.coverFileName ? `/api/audio/${t.id}/cover` : null,
  }));
}

/** Количество треков пользователя. */
export async function countAudio(userId: number): Promise<number> {
  const row = await db
    .select({ c: count() })
    .from(audioTracks)
    .where(eq(audioTracks.userId, userId))
    .get();
  return row?.c ?? 0;
}

/** Первые `limit` фото пользователя (новые сверху). */
export async function loadPhotoPreview(userId: number, limit = 6): Promise<PhotoPreviewItem[]> {
  const rows = await db
    .select({
      id: photos.id,
      fileName: photos.fileName,
      caption: photos.caption,
      createdAt: photos.createdAt,
    })
    .from(photos)
    .where(eq(photos.userId, userId))
    .orderBy(desc(photos.createdAt))
    .limit(limit)
    .all();

  return rows.map((p) => ({
    id: p.id,
    url: `/uploads/photos/${p.fileName}`,
    caption: p.caption,
    createdAt: p.createdAt.getTime(),
  }));
}

/** Количество фото пользователя. */
export async function countPhotos(userId: number): Promise<number> {
  const row = await db
    .select({ c: count() })
    .from(photos)
    .where(eq(photos.userId, userId))
    .get();
  return row?.c ?? 0;
}

/** Первые `limit` друзей пользователя (только принятые, новые сверху). */
export async function loadFriendPreview(userId: number, limit = 6): Promise<FriendPreviewItem[]> {
  const rows = await db
    .select({
      id: friends.id,
      userId: friends.userId,
      friendId: friends.friendId,
      createdAt: friends.createdAt,
    })
    .from(friends)
    .where(
      and(
        or(eq(friends.userId, userId), eq(friends.friendId, userId)),
        eq(friends.status, "accepted")
      )
    )
    .orderBy(desc(friends.createdAt))
    .limit(limit * 2)
    .all();

  const otherIds = [...new Set(rows.map((r) => (r.userId === userId ? r.friendId : r.userId)))];
  const others = otherIds.length
    ? await db
        .select({ id: users.id, nickname: users.nickname, skinUrl: users.skinUrl })
        .from(users)
        .where(inArray(users.id, otherIds))
        .all()
    : [];
  const byId = new Map(others.map((u) => [u.id, u]));

  const result: FriendPreviewItem[] = [];
  for (const r of rows) {
    const other = byId.get(r.userId === userId ? r.friendId : r.userId);
    if (!other) continue;
    result.push({
      id: other.id,
      nickname: other.nickname,
      skinUrl: other.skinUrl,
      since: r.createdAt.getTime(),
    });
    if (result.length >= limit) break;
  }
  return result;
}

/** Количество друзей пользователя (принятых). */
export async function countFriends(userId: number): Promise<number> {
  const row = await db
    .select({ c: count() })
    .from(friends)
    .where(
      and(
        or(eq(friends.userId, userId), eq(friends.friendId, userId)),
        eq(friends.status, "accepted")
      )
    )
    .get();
  return row?.c ?? 0;
}