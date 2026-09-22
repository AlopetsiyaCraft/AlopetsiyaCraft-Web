import { count, desc, eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { photoAlbums, photos, postComments, postPhotos, seasons, users, wallPosts } from "./db/schema";
import { photoCommentCounts, toPhotoItem } from "./photoRows";
import type { PostItem } from "./profile";

/** Записи стены пользователя (с фото и количеством комментариев), новые сверху. */
export async function loadPosts(userId: number): Promise<PostItem[]> {
  const postRows = await db
    .select({
      id: wallPosts.id,
      userId: wallPosts.userId,
      text: wallPosts.text,
      createdAt: wallPosts.createdAt,
      authorNickname: users.nickname,
      authorSkinUrl: users.skinUrl,
    })
    .from(wallPosts)
    .leftJoin(users, eq(wallPosts.userId, users.id))
    .where(eq(wallPosts.userId, userId))
    .orderBy(desc(wallPosts.createdAt))
    .limit(100)
    .all();

  const postIds = postRows.map((p) => p.id);
  if (postIds.length === 0) return [];

  const links = await db
    .select({ id: postPhotos.id, postId: postPhotos.postId, photoId: postPhotos.photoId })
    .from(postPhotos)
    .where(inArray(postPhotos.postId, postIds))
    .all();
  const photoIds = [...new Set(links.map((l) => l.photoId))];

  const photoRows = photoIds.length
    ? await db
        .select({
          id: photos.id,
          userId: photos.userId,
          seasonId: photos.seasonId,
          albumId: photos.albumId,
          visibility: photos.visibility,
          caption: photos.caption,
          createdAt: photos.createdAt,
          size: photos.size,
          originalName: photos.originalName,
          fileName: photos.fileName,
          authorNickname: users.nickname,
          albumName: photoAlbums.name,
          seasonNumber: seasons.number,
        })
        .from(photos)
        .leftJoin(users, eq(photos.userId, users.id))
        .leftJoin(photoAlbums, eq(photos.albumId, photoAlbums.id))
        .leftJoin(seasons, eq(photos.seasonId, seasons.id))
        .where(inArray(photos.id, photoIds))
        .all()
    : [];
  const photoById = new Map(photoRows.map((p) => [p.id, p]));

  const photoCountMap = await photoCommentCounts(photoIds);
  const postCommentRows = await db
    .select({ postId: postComments.postId, c: count(postComments.id).as("c") })
    .from(postComments)
    .where(inArray(postComments.postId, postIds))
    .groupBy(postComments.postId)
    .all();
  const postCountMap = new Map(postCommentRows.map((r) => [r.postId, r.c]));

  const photoGroups = new Map<number, typeof photoRows>();
  for (const link of links) {
    const p = photoById.get(link.photoId);
    if (!p) continue;
    if (!photoGroups.has(link.postId)) photoGroups.set(link.postId, []);
    photoGroups.get(link.postId)!.push(p);
  }

  return postRows.map((p) => ({
    id: p.id,
    userId: p.userId,
    text: p.text,
    createdAt: p.createdAt.getTime(),
    authorNickname: p.authorNickname ?? "unknown",
    authorSkinUrl: p.authorSkinUrl,
    photos: (photoGroups.get(p.id) ?? []).map((r) => toPhotoItem(r, photoCountMap)),
    commentCount: postCountMap.get(p.id) ?? 0,
  }));
}