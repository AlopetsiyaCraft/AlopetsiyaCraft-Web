import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

export const audioTracks = sqliteTable("audio_tracks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  artist: text("artist"),
  fileName: text("file_name").notNull(),
  coverFileName: text("cover_file_name"),
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
  // Болды (BLD) — внутриигровая валюта: фишки казино, кастомные пластинки и т.п.
  bld: integer("bld").notNull().default(0),
  // Фишки казино — тратятся только за карточными столами в Minecraft.
  chips: integer("chips").notNull().default(0),
  /** Купленные смены ника: тратятся при смене в настройках. */
  nameChangeCredits: integer("name_change_credits").notNull().default(0),
  // Кастомизация профиля (редактируется в настройках).
  nickColor: text("nick_color"),
  profileBg: text("profile_bg"),
  profileBgImage: text("profile_bg_image"),
  profileBgUnlocked: integer("profile_bg_unlocked", { mode: "boolean" })
    .notNull()
    .default(false),
  profileFrame: text("profile_frame"),
  socials: text("socials").notNull().default("{}"),
  featuredAchievements: text("featured_achievements").notNull().default("[]"),
  /** Порядок, видимость и ширина блоков на вкладке «Обзор». */
  profileLayout: text("profile_layout").notNull().default("[]"),
  // Когда последний раз крутили колесо ежедневного бонуса (раз в день).
  dailyBonusAt: integer("daily_bonus_at", { mode: "timestamp" }),
  lastActiveAt: integer("last_active_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/**
 * История прокрутов ежедневного бонуса. Нужна для истории и статистики:
 * сам кулдаун хранится в users.daily_bonus_at, чтобы проверку нельзя было
 * обойти параллельными запросами.
 */
export const dailySpins = sqliteTable(
  "daily_spins",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    prizeIndex: integer("prize_index").notNull(),
    kind: text("kind", { enum: ["bld", "chips"] }).notNull(),
    amount: integer("amount").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    userCreated: index("idx_daily_spins_user").on(t.userId, t.createdAt),
  })
);

/**
 * Товары магазина. Каталог живёт в базе, чтобы админ мог менять цены и
 * видимость без деплоя. payload — JSON с параметрами выдачи для мода.
 */
export const shopProducts = sqliteTable(
  "shop_products",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    category: text("category", {
      enum: ["cosmetic", "service", "currency", "custom"],
    })
      .notNull()
      .default("cosmetic"),
    icon: text("icon").notNull().default("🎁"),
    priceBld: integer("price_bld").notNull(),
    kind: text("kind", {
      enum: [
        "cape",
        "nick_effect",
        "pet",
        "title",
        "disc",
        "item",
        "chips",
        "frame",
        "profile_bg",
        "case",
        "name_change",
      ],
    }).notNull(),
    payload: text("payload").notNull().default("{}"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    maxPerUser: integer("max_per_user"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    activeSort: index("idx_shop_products_active").on(t.isActive, t.sortOrder),
  })
);

/**
 * Заказы магазина. Снимок названия/цены/payload хранится в заказе, чтобы
 * изменение товара в админке не ломало уже созданные заказы.
 */
export const shopOrders = sqliteTable(
  "shop_orders",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    productId: integer("product_id").references(() => shopProducts.id),
    nickname: text("nickname").notNull(),
    productTitle: text("product_title").notNull(),
    kind: text("kind").notNull(),
    priceBld: integer("price_bld").notNull(),
    payload: text("payload").notNull().default("{}"),
    status: text("status", {
      enum: ["pending", "delivered", "failed", "refunded"],
    })
      .notNull()
      .default("pending"),
    error: text("error"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    completedAt: integer("completed_at", { mode: "timestamp" }),
  },
  (t) => ({
    userCreated: index("idx_shop_orders_user").on(t.userId, t.createdAt),
    statusCreated: index("idx_shop_orders_status").on(t.status, t.createdAt),
  })
);

/**
 * История движения валют. Нужна для прозрачности экономики и разбора
 * спорных начислений: сколько, когда, почему и какой баланс получился.
 */
export const walletLedger = sqliteTable(
  "wallet_ledger",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    currency: text("currency", { enum: ["bld", "chips"] }).notNull(),
    amount: integer("amount").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    reason: text("reason").notNull(),
    refType: text("ref_type"),
    refId: integer("ref_id"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    userCreated: index("idx_wallet_ledger_user").on(t.userId, t.createdAt),
  })
);

/**
 * Уведомления игрока: заявки в друзья, комментарии, выдача заказов и т.п.
 * readAt = null означает непрочитанное; список в шапке сортируется по дате.
 */
export const notifications = sqliteTable(
  "notifications",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    type: text("type").notNull().default("system"),
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"),
    readAt: integer("read_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    userRead: index("idx_notifications_user_read").on(t.userId, t.readAt),
    userCreated: index("idx_notifications_user_created").on(t.userId, t.createdAt),
  })
);

/**
 * Купленные рамки аватара. Рамка — разовая покупка: запись здесь даёт
 * право выбрать её в настройках профиля. unique(user, frame) защищает
 * от повторной покупки.
 */
export const userFrames = sqliteTable(
  "user_frames",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    frameId: text("frame_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    userFrame: uniqueIndex("uq_user_frames_user_frame").on(t.userId, t.frameId),
  })
);

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
  /**
   * Ник единственного адресата: мод в игре отдаёт такую строку только ему,
   * а не всем (см. мод chatbridge). NULL — сообщение для всех.
   */
  target: text("target"),
  /** На какое сообщение это ответ (NULL — обычное сообщение). */
  replyToId: integer("reply_to_id"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/** Реакции на сообщения чата: один игрок — одна реакция каждого вида. */
export const chatReactions = sqliteTable(
  "chat_reactions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    messageId: integer("message_id")
      .notNull()
      .references(() => chatLogs.id),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    emoji: text("emoji").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    uniqueReaction: uniqueIndex("uq_chat_reactions").on(t.messageId, t.userId, t.emoji),
    message: index("idx_chat_reactions_message").on(t.messageId),
  })
);

/**
 * Достижения игроков (Minecraft advancements 1.12+). Присылает мод на сервере
 * через POST /api/achievements/from-server — как чат: ник игрока, заголовок,
 * рамка (task/goal/challenge) и т.д. Блок «Последние достижения» на главной
 * медленно прокручивает эту ленту.
 */
export const achievements = sqliteTable("achievements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  // Игровой ник (как в chat_logs) — без жёсткой привязки к аккаунту сайта.
  nickname: text("nickname").notNull(),
  // Minecraft-ид прогрессии, например "minecraft:story/mine_stone".
  advancementId: text("advancement_id").notNull().default(""),
  title: text("title").notNull(),
  description: text("description"),
  // Рамка достижения: task (зелёная) / goal (жёлтая) / challenge (фиолетовая).
  frame: text("frame", { enum: ["task", "goal", "challenge"] }).notNull().default("task"),
  // Id предмета-иконки, например "minecraft:stone_pickaxe" (пока для будущего).
  icon: text("icon").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/**
 * Просмотры страниц сайта — простая аналитика без внешних сервисов.
 * Нужна, чтобы понимать, какие разделы живые, а какие мёртвые.
 * Пишется анонимно: случайный id в localStorage, без cookie и IP.
 */
export const pageViews = sqliteTable("page_views", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  path: text("path").notNull(),
  sessionId: text("session_id").notNull(),
  userId: integer("user_id"),
  device: text("device", { enum: ["desktop", "mobile", "tablet"] })
    .notNull()
    .default("desktop"),
  source: text("source", { enum: ["web", "telegram"] })
    .notNull()
    .default("web"),
  referrer: text("referrer"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/**
 * Маркетплейс: активные лоты игроков. Предмет списывается из последнего
 * снимка инвентаря (эскроу), а покупателю создаётся заказ на выдачу в игре.
 */
export const marketListings = sqliteTable(
  "market_listings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sellerId: integer("seller_id")
      .notNull()
      .references(() => users.id),
    sellerNickname: text("seller_nickname").notNull(),
    /** Идентификатор предмета, например minecraft:diamond_sword. */
    itemKey: text("item_key").notNull(),
    title: text("title").notNull(),
    material: text("material").notNull(),
    icon: text("icon").notNull().default(""),
    /** Снимок стека из инвентаря (JSON). */
    itemData: text("item_data").notNull().default("{}"),
    priceBld: integer("price_bld").notNull(),
    status: text("status", { enum: ["active", "sold", "cancelled"] })
      .notNull()
      .default("active"),
    buyerId: integer("buyer_id"),
    buyerNickname: text("buyer_nickname"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    soldAt: integer("sold_at", { mode: "timestamp" }),
  },
  (t) => ({
    statusKey: index("idx_market_listings_status_key").on(t.status, t.itemKey),
    seller: index("idx_market_listings_seller").on(t.sellerId, t.createdAt),
  })
);

/** Заявки на покупку: BLD резервируются до исполнения или отмены. */
export const marketOrders = sqliteTable(
  "market_orders",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    nickname: text("nickname").notNull(),
    itemKey: text("item_key").notNull(),
    title: text("title").notNull(),
    material: text("material").notNull(),
    icon: text("icon").notNull().default(""),
    priceBld: integer("price_bld").notNull(),
    status: text("status", { enum: ["active", "filled", "cancelled"] })
      .notNull()
      .default("active"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    filledAt: integer("filled_at", { mode: "timestamp" }),
  },
  (t) => ({
    statusKey: index("idx_market_orders_status_key").on(t.status, t.itemKey),
    user: index("idx_market_orders_user").on(t.userId, t.createdAt),
  })
);

/** История продаж для графиков цены и «последних сделок». */
export const marketSales = sqliteTable(
  "market_sales",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    itemKey: text("item_key").notNull(),
    title: text("title").notNull(),
    material: text("material").notNull(),
    icon: text("icon").notNull().default(""),
    priceBld: integer("price_bld").notNull(),
    feeBld: integer("fee_bld").notNull().default(0),
    sellerId: integer("seller_id").notNull(),
    sellerNickname: text("seller_nickname").notNull(),
    buyerId: integer("buyer_id").notNull(),
    buyerNickname: text("buyer_nickname").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    keyCreated: index("idx_market_sales_key_created").on(t.itemKey, t.createdAt),
  })
);

export const usersRelations = relations(users, ({ many }) => ({  screenshots: many(screenshots),
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

/**
 * Статистика игроков с Minecraft-сервера (шлёт мод/скрипт моста через
 * POST /api/stats/from-server с ключом CHAT_API_KEY). По игроку и категории
 * хранится одно число; мод переприсылает актуальные значения — старые
 * перезаписываются.
 */
export const playerStats = sqliteTable(
  "player_stats",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    nickname: text("nickname").notNull(),
    // Ключ категории из src/lib/stats.ts (deaths, mob_kills, play_time, ...).
    category: text("category").notNull(),
    value: integer("value").notNull().default(0),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    nicknameCategory: uniqueIndex("uq_player_stats_nickname_category").on(t.nickname, t.category),
    categoryValue: index("idx_player_stats_category_value").on(t.category, t.value),
  })
);

/**
 * Снимки инвентаря игроков (шлёт мод AlopetsiyaInventory через
 * POST /api/inventory/from-server при выходе игрока с сервера). Страница
 * /inventory показывает текущий снимок владельца аккаунта. Ник хранится в
 * нижнем регистре (серверные ники регистронезависимы), display_nickname —
 * регистр, как прислал сервер. data — JSON с контейнерами (main/armor/
 * offhand/enderChest) и здоровьем игрока.
 */
export const playerInventories = sqliteTable(
  "player_inventories",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    nickname: text("nickname").notNull().unique(),
    displayNickname: text("display_nickname").notNull().default(""),
    data: text("data").notNull().default("{}"),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    nicknameIndex: uniqueIndex("uq_player_inventories_nickname").on(t.nickname),
  })
);

/**
 * История снимков инвентаря (админ-откаты). Каждый снимок от моста
 * AlopetsiyaInventory (вход/выход/остановка/периодика) дополнительно пишется
 * сюда; текущий снимок хранится в player_inventories. Ник — в нижнем регистре.
 */
export const inventorySnapshots = sqliteTable(
  "inventory_snapshots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    nickname: text("nickname").notNull(),
    displayNickname: text("display_nickname").notNull().default(""),
    data: text("data").notNull(),
    reason: text("reason").notNull().default("snapshot"),
    capturedAt: integer("captured_at").notNull(),
  },
  (t) => ({
    nicknameCaptured: index("idx_inv_snapshots_nickname_captured").on(
      t.nickname,
      t.capturedAt
    ),
  })
);

/**
 * Отложенный откат инвентаря: админ выбрал точку истории, она ждёт, пока мод
 * применит её при следующем входе игрока. Один ник — один pending (новая
 * команда заменяет старую). data — копия снимка на момент команды.
 */
export const pendingInventoryRestores = sqliteTable(
  "pending_inventory_restores",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    nickname: text("nickname").notNull(),
    snapshotId: integer("snapshot_id").notNull(),
    data: text("data").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => ({
    nicknameUnique: uniqueIndex("uq_pending_restore_nickname").on(t.nickname),
  })
);

/**
 * Сессии входа на Minecraft-сервер по паролю сайта (мод AlopetsiyaAuth).
 * Создаются при успешном POST /api/auth/mc-login: игрок ввёл ник+пароль
 * (те же, что на сайте), сайт выдаёт сессию с привязкой к IP и сроком жизни
 * (MC_SESSION_TTL_DAYS, по умолчанию 7 дней). При следующем входе мод
 * спрашивает /api/auth/mc-check: если сессия с того же IP ещё жива — пароль
 * не требуется. Один пользователь — одна активная сессия (новая заменяет старую).
 */
export const mcSessions = sqliteTable("mc_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  // Ник как в игре (canonical — как на сайте) и IP, с которого логинился.
  nickname: text("nickname").notNull(),
  ip: text("ip").notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
});
