import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

export const audioTracks = sqliteTable("audio_tracks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  artist: text("artist"),
  fileName: text("file_name").notNull(),
  size: integer("size").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const discRequests = sqliteTable("disc_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  trackId: integer("track_id")
    .notNull()
    .references(() => audioTracks.id),
  nickname: text("nickname").notNull(),
  status: text("status", { enum: ["pending", "done", "failed"] })
    .notNull()
    .default("pending"),
  error: text("error"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  completedAt: integer("completed_at", { mode: "timestamp" }),
});

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nickname: text("nickname").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  mcUuid: text("mc_uuid"),
  ipAddress: text("ip_address"),
  skinUrl: text("skin_url"),
  capeUrl: text("cape_url"),
  skinModel: text("skin_model", { enum: ["wide", "slim"] }).notNull().default("wide"),
  discordId: text("discord_id").unique(),
  role: text("role", { enum: ["user", "admin"] }).notNull().default("user"),
  lastActiveAt: integer("last_active_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const seasons = sqliteTable("seasons", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  number: integer("number").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(false),
  modpackUrl: text("modpack_url"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const screenshots = sqliteTable("screenshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  seasonId: integer("season_id")
    .notNull()
    .references(() => seasons.id),
  imageUrl: text("image_url").notNull(),
  caption: text("caption"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const comments = sqliteTable("comments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  screenshotId: integer("screenshot_id")
    .notNull()
    .references(() => screenshots.id),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  parentId: integer("parent_id"),
  text: text("text").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const chatLogs = sqliteTable("chat_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  seasonId: integer("season_id")
    .notNull()
    .references(() => seasons.id),
  nickname: text("nickname").notNull(),
  message: text("message").notNull(),
  source: text("source").notNull().default("website"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const usersRelations = relations(users, ({ many }) => ({
  screenshots: many(screenshots),
  comments: many(comments),
  audioTracks: many(audioTracks),
  discRequests: many(discRequests),
  photoAlbums: many(photoAlbums),
  photos: many(photos),
  photoComments: many(photoComments),
  wallPosts: many(wallPosts),
  postComments: many(postComments),
}));

export const seasonsRelations = relations(seasons, ({ many }) => ({
  screenshots: many(screenshots),
  chatLogs: many(chatLogs),
}));

export const screenshotsRelations = relations(screenshots, ({ one, many }) => ({
  user: one(users, {
    fields: [screenshots.userId],
    references: [users.id],
  }),
  season: one(seasons, {
    fields: [screenshots.seasonId],
    references: [seasons.id],
  }),
  comments: many(comments),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  screenshot: one(screenshots, {
    fields: [comments.screenshotId],
    references: [screenshots.id],
  }),
  user: one(users, {
    fields: [comments.userId],
    references: [users.id],
  }),
}));

export const chatLogsRelations = relations(chatLogs, ({ one }) => ({
  season: one(seasons, {
    fields: [chatLogs.seasonId],
    references: [seasons.id],
  }),
}));

export const audioTracksRelations = relations(audioTracks, ({ one, many }) => ({
  user: one(users, {
    fields: [audioTracks.userId],
    references: [users.id],
  }),
  discRequests: many(discRequests),
}));

export const photoAlbums = sqliteTable("photo_albums", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const photos = sqliteTable("photos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  seasonId: integer("season_id")
    .notNull()
    .references(() => seasons.id),
  albumId: integer("album_id").references(() => photoAlbums.id),
  // Имя файла на диске в data/uploads/photos/ (генерируем сами).
  fileName: text("file_name").notNull(),
  // Исходное имя файла пользователя — хранится (в нём часто дата).
  originalName: text("original_name").notNull(),
  size: integer("size").notNull(),
  // Кому видно фото: "public" — всем (включая анонимов), "registered" — только залогиненным.
  visibility: text("visibility", { enum: ["public", "registered"] })
    .notNull()
    .default("public"),
  caption: text("caption"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const photoComments = sqliteTable("photo_comments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  photoId: integer("photo_id")
    .notNull()
    .references(() => photos.id),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  parentId: integer("parent_id").references((): any => photoComments.id),
  text: text("text").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const wallPosts = sqliteTable("wall_posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  text: text("text").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const postPhotos = sqliteTable("post_photos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  postId: integer("post_id")
    .notNull()
    .references(() => wallPosts.id),
  photoId: integer("photo_id")
    .notNull()
    .references(() => photos.id),
});

export const postComments = sqliteTable("post_comments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  postId: integer("post_id")
    .notNull()
    .references(() => wallPosts.id),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  parentId: integer("parent_id").references((): any => postComments.id),
  text: text("text").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const photoCommentLikes = sqliteTable(
  "photo_comment_likes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    commentId: integer("comment_id")
      .notNull()
      .references(() => photoComments.id),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({ commentUser: uniqueIndex("uq_photo_comment_likes").on(t.commentId, t.userId) })
);

export const postCommentLikes = sqliteTable(
  "post_comment_likes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    commentId: integer("comment_id")
      .notNull()
      .references(() => postComments.id),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({ commentUser: uniqueIndex("uq_post_comment_likes").on(t.commentId, t.userId) })
);

/** Друзья: пара (userId, friendId) с user_id < friend_id, статус + кто запросил. */
export const friends = sqliteTable("friends", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  friendId: integer("friend_id")
    .notNull()
    .references(() => users.id),
  status: text("status", { enum: ["pending", "accepted"] })
    .notNull()
    .default("pending"),
  requesterId: integer("requester_id")
    .notNull()
    .references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const photoAlbumsRelations = relations(photoAlbums, ({ one, many }) => ({
  user: one(users, {
    fields: [photoAlbums.userId],
    references: [users.id],
  }),
  photos: many(photos),
}));

export const photosRelations = relations(photos, ({ one, many }) => ({
  user: one(users, {
    fields: [photos.userId],
    references: [users.id],
  }),
  season: one(seasons, {
    fields: [photos.seasonId],
    references: [seasons.id],
  }),
  album: one(photoAlbums, {
    fields: [photos.albumId],
    references: [photoAlbums.id],
  }),
  comments: many(photoComments),
  postLinks: many(postPhotos),
}));

export const photoCommentsRelations = relations(photoComments, ({ one }) => ({
  photo: one(photos, {
    fields: [photoComments.photoId],
    references: [photos.id],
  }),
  user: one(users, {
    fields: [photoComments.userId],
    references: [users.id],
  }),
}));

export const wallPostsRelations = relations(wallPosts, ({ one, many }) => ({
  user: one(users, {
    fields: [wallPosts.userId],
    references: [users.id],
  }),
  photos: many(postPhotos),
  comments: many(postComments),
}));

export const postPhotosRelations = relations(postPhotos, ({ one }) => ({
  post: one(wallPosts, {
    fields: [postPhotos.postId],
    references: [wallPosts.id],
  }),
  photo: one(photos, {
    fields: [postPhotos.photoId],
    references: [photos.id],
  }),
}));

export const postCommentsRelations = relations(postComments, ({ one }) => ({
  post: one(wallPosts, {
    fields: [postComments.postId],
    references: [wallPosts.id],
  }),
  user: one(users, {
    fields: [postComments.userId],
    references: [users.id],
  }),
}));

export const discRequestsRelations = relations(discRequests, ({ one }) => ({
  user: one(users, {
    fields: [discRequests.userId],
    references: [users.id],
  }),
  track: one(audioTracks, {
    fields: [discRequests.trackId],
    references: [audioTracks.id],
  }),
}));

export const playersOnline = sqliteTable("players_online", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nickname: text("nickname").notNull().unique(),
  skinUrl: text("skin_url"),
  lastSeen: integer("last_seen", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const skinHistory = sqliteTable("skin_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  skinUrl: text("skin_url").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const nameHistory = sqliteTable("name_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  nickname: text("nickname").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const capeHistory = sqliteTable("cape_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  capeUrl: text("cape_url").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
