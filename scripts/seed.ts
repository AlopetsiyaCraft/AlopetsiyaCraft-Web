import { db } from "../src/lib/db";
import { seasons } from "../src/lib/db/schema";

const seedSeasons = [
  {
    number: 1,
    name: "АлокопецияКрафт Сезон 1",
    description: "Первый сезон нашего сервера",
    isActive: false,
  },
  {
    number: 2,
    name: "АлокопецияКрафт Сезон 2",
    description: "Второй сезон с новыми модами",
    isActive: false,
  },
  {
    number: 3,
    name: "АлокопецияКрафт Сезон 3",
    description: "Третий сезон с интеграцией Discord",
    isActive: false,
  },
  {
    number: 4,
    name: "АлокопецияКрафт Сезон 4",
    description: "Четвёртый сезон — Готовься!",
    isActive: true,
  },
];

console.log("Seeding database...");

for (const season of seedSeasons) {
  try {
    db.insert(seasons).values(season).run();
    console.log(`✓ Season ${season.number} added`);
  } catch (e) {
    console.log(`- Season ${season.number} already exists`);
  }
}

console.log("Done!");
