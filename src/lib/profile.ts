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
  authorNickname: string;
  albumName: string | null;
  seasonNumber: number | null;
  commentCount: number;
}

export interface PhotoCommentItem {
  id: number;
  photoId: number;
  text: string;
  createdAt: number;
  authorNickname: string;
  viewerIsAuthor: boolean;
}

export interface PostCommentItem {
  id: number;
  postId: number;
  text: string;
  createdAt: number;
  authorNickname: string;
  viewerIsAuthor: boolean;
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