import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nickname: text("nickname").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  mcUuid: text("mc_uuid"),
  ipAddress: text("ip_address"),
  skinUrl: text("skin_url"),
  capeUrl: text("cape_url"),
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
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const usersRelations = relations(users, ({ many }) => ({
  screenshots: many(screenshots),
  comments: many(comments),
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
