/** Общие типы профиля/галереи/стены (общие для сервера и клиента). */

export type PhotoVisibility = "public" | "registered";

export interface PhotoItem {
  id: number;
  userId: number;
  seasonId: number;
  albumId: number | null;
  visibility: PhotoVisibility;
  caption: string | null;
  createdAt: number;
  size: number;
  originalName: string;
  url: string;
  thumbUrl: string;
  authorNickname: string;
  albumName: string | null;
  seasonNumber: number | null;
  commentCount: number;
}

/** Кто оценил комментарий (для тултипа «Оценили»). */
export interface CommentLikeUser {
  nickname: string;
  skinUrl: string | null;
}

/** База комментария (фото и стены): плоский список + parentId для дерева ответов. */
interface CommentBase {
  id: number;
  text: string;
  createdAt: number;
  authorNickname: string;
  authorId: number;
  authorSkinUrl: string | null;
  parentId: number | null;
  replyToNickname: string | null;
  viewerIsAuthor: boolean;
  likeCount: number;
  likedByMe: boolean;
  likers: CommentLikeUser[];
}

export interface PhotoCommentItem extends CommentBase {
  photoId: number;
}

export interface PostCommentItem extends CommentBase {
  postId: number;
}

export interface PostItem {
  id: number;
  userId: number;
  text: string;
  createdAt: number;
  authorNickname: string;
  authorSkinUrl: string | null;
  photos: PhotoItem[];
  commentCount: number;
}

export interface FriendUser {
  id: number;
  nickname: string;
  skinUrl: string | null;
}

export interface FriendsResponse {
  accepted: Array<FriendUser & { since: number }>;
  incoming: Array<FriendUser & { since: number }>;
  outgoing: Array<FriendUser & { since: number }>;
}

export interface AlbumsListItem {
  id: number;
  name: string;
  photoCount: number;
  createdAt: number;
}