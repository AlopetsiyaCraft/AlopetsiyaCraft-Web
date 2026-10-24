import "dotenv/config";
import { createClient } from "@libsql/client";
import { mkdirSync } from "fs";
import { dirname } from "path";
import { SYSTEM_NICKNAME, SYSTEM_SKIN } from "@/lib/chatSystem";

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
    bld INTEGER NOT NULL DEFAULT 0,
    chips INTEGER NOT NULL DEFAULT 0,
    name_change_credits INTEGER NOT NULL DEFAULT 0,
    nick_color TEXT,
    profile_bg TEXT,
    profile_bg_image TEXT,
    profile_bg_unlocked INTEGER NOT NULL DEFAULT 0,
    profile_frame TEXT,
    socials TEXT NOT NULL DEFAULT '{}',
    featured_achievements TEXT NOT NULL DEFAULT '[]',
    profile_layout TEXT NOT NULL DEFAULT '[]',
    last_active_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS daily_spins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    prize_index INTEGER NOT NULL,
    kind TEXT NOT NULL,
    amount INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE INDEX IF NOT EXISTS idx_daily_spins_user ON daily_spins(user_id, created_at);

  CREATE TABLE IF NOT EXISTS shop_products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'cosmetic',
    icon TEXT NOT NULL DEFAULT '🎁',
    price_bld INTEGER NOT NULL,
    kind TEXT NOT NULL,
    payload TEXT NOT NULL DEFAULT '{}',
    is_active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    max_per_user INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE INDEX IF NOT EXISTS idx_shop_products_active ON shop_products(is_active, sort_order);

  CREATE TABLE IF NOT EXISTS shop_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    product_id INTEGER REFERENCES shop_products(id),
    nickname TEXT NOT NULL,
    product_title TEXT NOT NULL,
    kind TEXT NOT NULL,
    price_bld INTEGER NOT NULL,
    payload TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending',
    error TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    completed_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_shop_orders_user ON shop_orders(user_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_shop_orders_status ON shop_orders(status, created_at);

  CREATE TABLE IF NOT EXISTS wallet_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    currency TEXT NOT NULL,
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    reason TEXT NOT NULL,
    ref_type TEXT,
    ref_id INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE INDEX IF NOT EXISTS idx_wallet_ledger_user ON wallet_ledger(user_id, created_at);

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    type TEXT NOT NULL DEFAULT 'system',
    title TEXT NOT NULL,
    body TEXT,
    link TEXT,
    read_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read_at);
  CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at);

  CREATE TABLE IF NOT EXISTS user_frames (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    frame_id TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE(user_id, frame_id)
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
    target TEXT,
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
    cover_file_name TEXT,
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
  CREATE TABLE IF NOT EXISTS photo_comment_likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    comment_id INTEGER NOT NULL REFERENCES photo_comments(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE (comment_id, user_id)
  );
  CREATE INDEX IF NOT EXISTS idx_photo_comment_likes_comment ON photo_comment_likes(comment_id);
  CREATE INDEX IF NOT EXISTS idx_wall_posts_user ON wall_posts(user_id);
  CREATE INDEX IF NOT EXISTS idx_post_photos_post ON post_photos(post_id);
  CREATE INDEX IF NOT EXISTS idx_post_comments_post ON post_comments(post_id);
  CREATE INDEX IF NOT EXISTS idx_post_comments_parent ON post_comments(parent_id);
  CREATE TABLE IF NOT EXISTS post_comment_likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    comment_id INTEGER NOT NULL REFERENCES post_comments(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE (comment_id, user_id)
  );
  CREATE INDEX IF NOT EXISTS idx_post_comment_likes_comment ON post_comment_likes(comment_id);
  CREATE INDEX IF NOT EXISTS idx_friends_a ON friends(user_id);
  CREATE INDEX IF NOT EXISTS idx_friends_b ON friends(friend_id);

  CREATE TABLE IF NOT EXISTS achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nickname TEXT NOT NULL,
    advancement_id TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL,
    description TEXT,
    frame TEXT NOT NULL DEFAULT 'task',
    icon TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE INDEX IF NOT EXISTS idx_achievements_created ON achievements(created_at);

  CREATE TABLE IF NOT EXISTS player_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nickname TEXT NOT NULL,
    category TEXT NOT NULL,
    value INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE(nickname, category)
  );
  CREATE INDEX IF NOT EXISTS idx_player_stats_category_value ON player_stats(category, value);

  CREATE TABLE IF NOT EXISTS player_inventories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nickname TEXT NOT NULL UNIQUE,
    display_nickname TEXT NOT NULL DEFAULT '',
    data TEXT NOT NULL DEFAULT '{}',
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS inventory_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nickname TEXT NOT NULL,
    display_nickname TEXT NOT NULL DEFAULT '',
    data TEXT NOT NULL,
    reason TEXT NOT NULL DEFAULT 'snapshot',
    captured_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_inv_snapshots_nickname_captured ON inventory_snapshots(nickname, captured_at);

  CREATE TABLE IF NOT EXISTS pending_inventory_restores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nickname TEXT NOT NULL,
    snapshot_id INTEGER NOT NULL,
    data TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE(nickname)
  );

  CREATE TABLE IF NOT EXISTS mc_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    nickname TEXT NOT NULL,
    ip TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_mc_sessions_nickname ON mc_sessions(nickname);
  CREATE INDEX IF NOT EXISTS idx_mc_sessions_user ON mc_sessions(user_id);

  CREATE TABLE IF NOT EXISTS page_views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT NOT NULL,
    session_id TEXT NOT NULL,
    user_id INTEGER,
    device TEXT NOT NULL DEFAULT 'desktop',
    source TEXT NOT NULL DEFAULT 'web',
    referrer TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE INDEX IF NOT EXISTS idx_page_views_path_created ON page_views(path, created_at);
  CREATE INDEX IF NOT EXISTS idx_page_views_session_path ON page_views(session_id, path, created_at);

  CREATE TABLE IF NOT EXISTS market_listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_id INTEGER NOT NULL REFERENCES users(id),
    seller_nickname TEXT NOT NULL,
    item_key TEXT NOT NULL,
    title TEXT NOT NULL,
    material TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT '',
    item_data TEXT NOT NULL DEFAULT '{}',
    price_bld INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    buyer_id INTEGER,
    buyer_nickname TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    sold_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_market_listings_status_key ON market_listings(status, item_key);
  CREATE INDEX IF NOT EXISTS idx_market_listings_seller ON market_listings(seller_id, created_at);

  CREATE TABLE IF NOT EXISTS market_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    nickname TEXT NOT NULL,
    item_key TEXT NOT NULL,
    title TEXT NOT NULL,
    material TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT '',
    price_bld INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    filled_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_market_orders_status_key ON market_orders(status, item_key);
  CREATE INDEX IF NOT EXISTS idx_market_orders_user ON market_orders(user_id, created_at);

  CREATE TABLE IF NOT EXISTS market_sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_key TEXT NOT NULL,
    title TEXT NOT NULL,
    material TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT '',
    price_bld INTEGER NOT NULL,
    fee_bld INTEGER NOT NULL DEFAULT 0,
    seller_id INTEGER NOT NULL,
    seller_nickname TEXT NOT NULL,
    buyer_id INTEGER NOT NULL,
    buyer_nickname TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE INDEX IF NOT EXISTS idx_market_sales_key_created ON market_sales(item_key, created_at);
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
  try {
    // legacy: Болды (BLD) — внутриигровая валюта
    await client.execute(`ALTER TABLE users ADD COLUMN bld INTEGER NOT NULL DEFAULT 0`);
  } catch (e) {
    // column already exists
  }
  try {
    // legacy: Фишки казино — отдельная валюта для столов в Minecraft
    await client.execute(`ALTER TABLE users ADD COLUMN chips INTEGER NOT NULL DEFAULT 0`);
  } catch (e) {
    // column already exists
  }
  try {
    // legacy: купленные смены ника
    await client.execute(
      `ALTER TABLE users ADD COLUMN name_change_credits INTEGER NOT NULL DEFAULT 0`
    );
  } catch (e) {
    // column already exists
  }
  try {
    // legacy: время последнего прокрута колеса ежедневного бонуса
    await client.execute(`ALTER TABLE users ADD COLUMN daily_bonus_at INTEGER`);
  } catch (e) {
    // column already exists
  }
  // legacy: кастомизация профиля (цвета, соцсети, витрина)
  for (const ddl of [
    `ALTER TABLE users ADD COLUMN nick_color TEXT`,
    `ALTER TABLE users ADD COLUMN profile_bg TEXT`,
    `ALTER TABLE users ADD COLUMN profile_bg_image TEXT`,
    `ALTER TABLE users ADD COLUMN profile_bg_unlocked INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN profile_frame TEXT`,
    `ALTER TABLE users ADD COLUMN socials TEXT NOT NULL DEFAULT '{}'`,
    `ALTER TABLE users ADD COLUMN featured_achievements TEXT NOT NULL DEFAULT '[]'`,
    `ALTER TABLE users ADD COLUMN profile_layout TEXT NOT NULL DEFAULT '[]'`,
  ]) {
    try {
      await client.execute(ddl);
    } catch {
      // column already exists
    }
  }

  // Рамки, выбранные до появления магазина, сохраняем за игроками:
  // иначе после обновления профиль молча терял рамку, а сохранение падало
  // с «рамка не куплена».
  await client.execute(
    `INSERT OR IGNORE INTO user_frames (user_id, frame_id)
     SELECT id, profile_frame FROM users
     WHERE profile_frame IS NOT NULL
       AND profile_frame != ''
       AND profile_frame != 'none'`
  );
  try {
    // legacy: пиксельная обложка пластинки (фото альбома, 16x16 PNG)
    await client.execute(`ALTER TABLE audio_tracks ADD COLUMN cover_file_name TEXT`);
  } catch (e) {
    // column already exists
  }
  try {
    // legacy: адресат сообщения чата — мод в игре отдаёт такую строку только
    // ему, а не всем. NULL означает «для всех».
    await client.execute(`ALTER TABLE chat_logs ADD COLUMN target TEXT`);
  } catch (e) {
    // column already exists
  }

  // Служебный профиль "System" — от него пишутся объявления сайта в чат.
  // Нужен, чтобы ник был настоящей учёткой со скином: и чат сайта, и мод голов
  // в игре берут голову по нику, поэтому отдельная логика для System не нужна.
  // Профиль скрыт (см. lib/chatSystem.ts) и недоступен для входа: пароль от
  // него сгенерирован, не сохранён и нигде не используется — войти нельзя.
  // INSERT OR IGNORE не трогает уже существующий профиль, поэтому выбранный
  // скин переживает перезапуск и обновления.
  await client.execute(
    `INSERT OR IGNORE INTO users (nickname, password_hash, skin_url) VALUES (?, ?, ?)`,
    [SYSTEM_NICKNAME, "$2b$10$AnIgBn/eRyesLcdXvVfh6edb6oEW4j4gNA1FgWPD8L4.s2WyD8.QO", SYSTEM_SKIN]
  );

  // Стартовый каталог магазина. Заполняем только пустую таблицу, чтобы
  // правки админа (цены, скрытие товаров) переживали перезапуск.
  const productsCount = await client.execute(`SELECT COUNT(*) AS c FROM shop_products`);
  const hasProducts = Number(productsCount.rows[0]?.c ?? 0) > 0;
  if (!hasProducts) {
    const defaults: Array<[string, string, string, string, string, number, string, string, number]> = [
      ["title-chat", "Титул в чате", "Подпись под ником в чате сервера.", "cosmetic", "🏷", 25, "title", JSON.stringify({ title: "Легенда Алопеции" }), 10],
      ["nick-effect", "Ник-эффект", "Цветной ник и рамка в чате сервера.", "cosmetic", "✨", 40, "nick_effect", JSON.stringify({ style: "gradient", colors: ["#5d9c3c", "#f2c94c"] }), 20],
      ["custom-item", "Кастомный предмет", "Именной предмет с зачарованиями в инвентарь.", "custom", "⚔", 60, "item", JSON.stringify({ material: "minecraft:diamond_sword", name: "Клинок Алопеции", lore: ["Выкован на сайте"], enchants: { "minecraft:sharpness": 3 } }), 30],
      ["custom-cape", "Кастомный плащ", "Свой плащ на сервере: рисунок согласуем после покупки.", "cosmetic", "🛡", 90, "cape", JSON.stringify({ design: "custom" }), 40],
      ["pet", "Питомец", "Спутник с именем, который будет бегать за тобой в игре.", "custom", "🐺", 120, "pet", JSON.stringify({ mob: "minecraft:wolf", name: "Верный друг" }), 50],
    ];
    for (const [slug, title, description, category, icon, priceBld, kind, payload, sortOrder] of defaults) {
      await client.execute(
        `INSERT INTO shop_products (slug, title, description, category, icon, price_bld, kind, payload, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [slug, title, description, category, icon, priceBld, kind, payload, sortOrder]
      );
    }
  }

  // Новые товары кастомизации добавляем идемпотентно: на существующей базе
  // стартовый каталог уже заполнен, но рамки и свой фон должны появиться.
  const customizationProducts: Array<
    [string, string, string, string, string, number, string, string, number, number]
  > = [
    ["frame-gold", "Золотая рамка", "Золотая рамка вокруг аватара в профиле.", "cosmetic", "🟨", 50, "frame", JSON.stringify({ frame: "gold" }), 60, 1],
    ["frame-green", "Изумрудная рамка", "Изумрудная рамка вокруг аватара в профиле.", "cosmetic", "🟩", 50, "frame", JSON.stringify({ frame: "green" }), 61, 1],
    ["frame-red", "Редстоун-рамка", "Красная рамка вокруг аватара в профиле.", "cosmetic", "🟥", 60, "frame", JSON.stringify({ frame: "red" }), 62, 1],
    ["frame-purple", "Аметистовая рамка", "Фиолетовая рамка вокруг аватара в профиле.", "cosmetic", "🟪", 80, "frame", JSON.stringify({ frame: "purple" }), 63, 1],
    ["frame-blue", "Алмазная рамка", "Голубая рамка вокруг аватара в профиле.", "cosmetic", "🟦", 80, "frame", JSON.stringify({ frame: "blue" }), 64, 1],
    ["profile-bg-upload", "Свой фон профиля", "Разовая покупка: загрузи любую картинку в шапку профиля.", "custom", "🖼", 100, "profile_bg", "{}", 70, 1],
  ];
  for (const [slug, title, description, category, icon, priceBld, kind, payload, sortOrder, maxPerUser] of customizationProducts) {
    await client.execute(
      `INSERT OR IGNORE INTO shop_products
         (slug, title, description, category, icon, price_bld, kind, payload, sort_order, max_per_user)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [slug, title, description, category, icon, priceBld, kind, payload, sortOrder, maxPerUser]
    );
  }

  client.close();
}