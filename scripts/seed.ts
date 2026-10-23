import "dotenv/config";
import { initDatabase } from "../src/lib/db/bootstrap";
import { db } from "../src/lib/db";
import { seasons, shopProducts } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";

const seedSeasons = [
  {
    number: 1,
    name: "АлопецияКрафт Сезон 1",
    isActive: false,
  },
  {
    number: 2,
    name: "АлопецияКрафт Сезон 2",
    isActive: false,
  },
  {
    number: 3,
    name: "АлопецияКрафт Сезон 3",
    isActive: false,
  },
  {
    number: 4,
    name: "АлопецияКрафт Сезон 4",
    isActive: true,
  },
];

const seedProducts = [
  {
    slug: "case-ore",
    title: "Кейс «Рудный»",
    description: "Болды, фишки и косметика. Внутри 8 призов с разными шансами.",
    category: "custom" as const,
    icon: "🎁",
    priceBld: 50,
    kind: "case" as const,
    payload: JSON.stringify({
      prizes: [
        { label: "40 BLD", weight: 34, kind: "bld", amount: 40 },
        { label: "100 BLD", weight: 20, kind: "bld", amount: 100 },
        { label: "200 BLD", weight: 8, kind: "bld", amount: 200 },
        { label: "10 фишек", weight: 12, kind: "chips", amount: 10 },
        { label: "Изумрудная рамка", weight: 9, kind: "frame", frame: "green", duplicateBld: 40 },
        { label: "Аметистовая рамка", weight: 7, kind: "frame", frame: "purple", duplicateBld: 60 },
        {
          label: "Титул «Счастливчик кейса»",
          weight: 7,
          kind: "title",
          payload: { title: "Счастливчик кейса" },
        },
        {
          label: "Питомец: кот",
          weight: 3,
          kind: "pet",
          payload: { mob: "minecraft:cat", name: "Кот из кейса" },
        },
      ],
    }),
    sortOrder: 20,
  },
  {
    slug: "case-legend",
    title: "Кейс «Легендарный»",
    description: "Дорогой кейс с крупными болдами, редкими рамками и именным оружием.",
    category: "custom" as const,
    icon: "👑",
    priceBld: 250,
    kind: "case" as const,
    payload: JSON.stringify({
      prizes: [
        { label: "100 BLD", weight: 28, kind: "bld", amount: 100 },
        { label: "300 BLD", weight: 14, kind: "bld", amount: 300 },
        { label: "Золотая рамка", weight: 18, kind: "frame", frame: "gold", duplicateBld: 50 },
        { label: "Алмазная рамка", weight: 10, kind: "frame", frame: "blue", duplicateBld: 80 },
        {
          label: "Легендарный волк",
          weight: 12,
          kind: "pet",
          payload: { mob: "minecraft:wolf", name: "Легендарный волк" },
        },
        {
          label: "Клинок легенды",
          weight: 12,
          kind: "item",
          payload: {
            material: "minecraft:diamond_sword",
            name: "Клинок легенды",
            lore: ["Из легендарного кейса"],
            enchants: { "minecraft:sharpness": 5, "minecraft:unbreaking": 3 },
          },
        },
        {
          label: "Титул «Легенда Алопеции»",
          weight: 6,
          kind: "title",
          payload: { title: "Легенда Алопеции" },
        },
      ],
    }),
    sortOrder: 21,
  },
  {
    slug: "name-change",
    title: "Смена ника",
    description: "Одна платная смена ника. Применяется в настройках профиля.",
    category: "service" as const,
    icon: "✏️",
    priceBld: 100,
    kind: "name_change" as const,
    payload: JSON.stringify({ amount: 1 }),
    sortOrder: 30,
    maxPerUser: null,
  },
];

async function main() {
  console.log("Initializing database schema...");
  await initDatabase();

  console.log("Seeding database...");

  for (const season of seedSeasons) {
    try {
      await db.insert(seasons).values(season).run();
      console.log(`✓ Season ${season.number} added`);
    } catch (e) {
      console.log(`- Season ${season.number} already exists`);
    }
  }

  for (const product of seedProducts) {
    const existing = await db
      .select({ id: shopProducts.id })
      .from(shopProducts)
      .where(eq(shopProducts.slug, product.slug))
      .get();
    if (existing) {
      console.log(`- Product ${product.slug} already exists`);
      continue;
    }
    await db.insert(shopProducts).values(product).run();
    console.log(`✓ Product ${product.slug} added`);
  }

  console.log("Done!");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});