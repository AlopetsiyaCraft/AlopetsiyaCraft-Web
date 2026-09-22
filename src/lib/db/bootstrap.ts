import "dotenv/config";
import { createClient } from "@libsql/client";
import { mkdirSync } from "fs";
import { dirname } from "path";

// Local file by default; set DATABASE_URL to a libsql:// URL (e.g. Turso) to
// keep accounts in the cloud so they survive reinstalls / machine moves.
export const DB_URL = process.env.DATABASE_URL ?? "file:./data/database.db";

export function createDbClient() {
  if (DB_URL.startsWith("file:")) {
    mkdirSync(dirname(DB_URL.slice("file:".length)), { recursive: true });
  }
  return createClient({
    url: DB_URL,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });
}

// Mirrors src/lib/db/schema.ts. Idempotent: safe to run on every start.
export const bootstrapSql = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nickname TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    mc_uuid TEXT,
    ip_address TEXT,
    skin_url TEXT,
    cape_url TEXT,
    skin_model TEXT NOT NULL DEFAULT 'wide',
    discord_id TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    last_active_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS seasons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    number INTEGER NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 0,
    modpack_url TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS screenshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    season_id INTEGER NOT NULL REFERENCES seasons(id),
    image_url TEXT NOT NULL,
    caption TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    screenshot_id INTEGER NOT NULL REFERENCES screenshots(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    parent_id INTEGER,
    text TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS chat_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    season_id INTEGER NOT NULL REFERENCES seasons(id),
    nickname TEXT NOT NULL,
    message TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'website',
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS players_online (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nickname TEXT NOT NULL UNIQUE,
    skin_url TEXT,
    last_seen INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS skin_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    skin_url TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS name_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    nickname TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS cape_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    cape_url TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS audio_tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    artist TEXT,
    file_name TEXT NOT NULL,
    size INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS disc_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    track_id INTEGER NOT NULL REFERENCES audio_tracks(id),
    nickname TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    error TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    completed_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS photo_albums (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    season_id INTEGER NOT NULL REFERENCES seasons(id),
    album_id INTEGER REFERENCES photo_albums(id),
    file_name TEXT NOT NULL,
    original_name TEXT NOT NULL,
    size INTEGER NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'public',
    caption TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS photo_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    photo_id INTEGER NOT NULL REFERENCES photos(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    parent_id INTEGER REFERENCES photo_comments(id),
    text TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS wall_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    text TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS post_photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL REFERENCES wall_posts(id),
    photo_id INTEGER NOT NULL REFERENCES photos(id)
  );

  CREATE TABLE IF NOT EXISTS post_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL REFERENCES wall_posts(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    parent_id INTEGER REFERENCES post_comments(id),
    text TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS friends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    friend_id INTEGER NOT NULL REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'pending',
    requester_id INTEGER NOT NULL REFERENCES users(id),
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE(user_id, friend_id)
  );

  CREATE INDEX IF NOT EXISTS idx_photos_season ON photos(season_id);
  CREATE INDEX IF NOT EXISTS idx_photos_user ON photos(user_id);
  CREATE INDEX IF NOT EXISTS idx_photo_comments_photo ON photo_comments(photo_id);
  CREATE INDEX IF NOT EXISTS idx_photo_comments_parent ON photo_comments(parent_id);
  CREATE INDEX IF NOT EXISTS idx_wall_posts_user ON wall_posts(user_id);
  CREATE INDEX IF NOT EXISTS idx_post_photos_post ON post_photos(post_id);
  CREATE INDEX IF NOT EXISTS idx_post_comments_post ON post_comments(post_id);
  CREATE INDEX IF NOT EXISTS idx_post_comments_parent ON post_comments(parent_id);
  CREATE INDEX IF NOT EXISTS idx_friends_a ON friends(user_id);
  CREATE INDEX IF NOT EXISTS idx_friends_b ON friends(friend_id);
`;

/** Creates the schema if missing (+ legacy ALTERs). Run at db:init / seed / prestart. */
export async function initDatabase() {
  const client = createDbClient();
  // legacy: ответы на комментарии (дерево) — колонка нужна до создания индексов
  try {
    await client.execute(`ALTER TABLE photo_comments ADD COLUMN parent_id INTEGER`);
  } catch (e) {
    // column already exists (fresh db has it in CREATE TABLE)
  }
  try {
    await client.execute(`ALTER TABLE post_comments ADD COLUMN parent_id INTEGER`);
  } catch (e) {
    // column already exists (fresh db has it in CREATE TABLE)
  }
  await client.executeMultiple(bootstrapSql);
  try {
    // legacy: older local DBs created without skin_url
    await client.execute(`ALTER TABLE users ADD COLUMN skin_url TEXT`);
  } catch (e) {
    // column already exists
  }
  try {
    // legacy: chat bridge source column
    await client.execute(`ALTER TABLE chat_logs ADD COLUMN source TEXT NOT NULL DEFAULT 'website'`);
  } catch (e) {
    // column already exists
  }
  try {
    // legacy: Discord-связка аккаунтов (discord_id у пользователя)
    await client.execute(`ALTER TABLE users ADD COLUMN discord_id TEXT`);
  } catch (e) {
    // column already exists
  }
  try {
    // legacy: модель персонажа (wide = Стив, slim = Алекс) — её выбирает
    // сам игрок, PNG 64x64 сам по себе не сообщает, тонкая модель или широкая
    await client.execute(`ALTER TABLE users ADD COLUMN skin_model TEXT NOT NULL DEFAULT 'wide'`);
  } catch (e) {
    // column already exists
  }
  client.close();
}