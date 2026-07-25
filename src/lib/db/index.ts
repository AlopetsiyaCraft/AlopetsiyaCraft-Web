import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { dirname } from "path";
import * as schema from "./schema";

const DB_PATH = "./data/database.db";

mkdirSync(dirname(DB_PATH), { recursive: true });

const sqlite = new Database(DB_PATH);

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nickname TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    mc_uuid TEXT,
    ip_address TEXT,
    skin_url TEXT,
    role TEXT NOT NULL DEFAULT 'user',
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
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
`);

try {
  sqlite.exec(`ALTER TABLE users ADD COLUMN skin_url TEXT`);
} catch (e) {
  // column already exists
}

export const db = drizzle(sqlite, { schema });
