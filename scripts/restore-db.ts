import "dotenv/config";
import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from "fs";
import { join, resolve } from "path";
import { createClient } from "@libsql/client";
import { initDatabase, DB_URL } from "../src/lib/db/bootstrap";

/**
 * Импорт базы с другого компьютера (например, с Windows-машины, где живёт
 * Minecraft-сервер) в локальную data/database.db.
 *
 *   npm run db:restore -- <путь-к-папке-data>
 *
 * Например:
 *   npm run db:restore -- /Volumes/USB/AlopetsiyaCraft/data
 *   npm run db:restore -- "D:\Games\Minecraft\Servers\AlopetsiyaCraft Season4\data"
 *
 * Что делает:
 *   1. Копирует <src>/database.db → data/database.db (текущая база уходит
 *      в data/backups/database-<timestamp>.db).
 *   2. Копирует <src>/uploads → data/uploads (если папка есть). В базе
 *      лежат только ИМЕНА файлов, поэтому без uploads скины/плащи/фото/
 *      обложки не отдаются — картинки будут битыми.
 *   3. Гоняет initDatabase(): он идемпотентный и добавит недостающие
 *      таблицы/колонки, если база со старой версии сайта.
 *   4. Печатает количество строк в ключевых таблицах.
 *
 * ВАЖНО: перед импортом останови сайт (и сервер Minecraft) — иначе файл
 * базы может копироваться посреди записи.
 */

const srcArg = process.argv[2];

if (!srcArg) {
  console.error(
    "Укажи путь к папке data с Windows-машины:\n" +
      "  npm run db:restore -- <путь-к-папке-data>"
  );
  process.exit(1);
}

const src = resolve(srcArg.replace(/^["']|["']$/g, ""));
const srcDb = join(src, "database.db");
const srcUploads = join(src, "uploads");

if (!existsSync(srcDb)) {
  console.error(`Не найден файл базы: ${srcDb}`);
  console.error("Проверь путь — должна быть папка data, внутри database.db.");
  process.exit(1);
}

/** Считает файлы в папке рекурсивно. */
function countFiles(dir: string): number {
  let n = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    n += entry.isDirectory() ? countFiles(p) : 1;
  }
  return n;
}

async function main() {
  const root = process.cwd();
  const dstDir = join(root, "data");
  const dstDb = join(dstDir, "database.db");
  const dstUploads = join(dstDir, "uploads");
  const backupDir = join(dstDir, "backups");

  mkdirSync(dstDir, { recursive: true });
  mkdirSync(backupDir, { recursive: true });

  // --- 1. бэкап текущей базы ---
  if (existsSync(dstDb)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backup = join(backupDir, `database-${stamp}.db`);
    cpSync(dstDb, backup);
    console.log(`✓ Текущая база сохранена в ${backup}`);
  }

  // --- 2. копируем базу ---
  cpSync(srcDb, dstDb);
  console.log(`✓ База скопирована: ${srcDb} → ${dstDb}`);

  // --- 3. копируем загруженные файлы ---
  if (existsSync(srcUploads)) {
    cpSync(srcUploads, dstUploads, { recursive: true });
    console.log(
      `✓ Файлы загрузок скопированы: ${srcUploads} → ${dstUploads} ` +
        `(${countFiles(dstUploads)} шт.)`
    );
  } else {
    console.log(
      "! Папки uploads в источнике нет — скины/плащи/фото/обложки останутся " +
        "без файлов (в базе есть только имена)."
    );
  }

  // --- 4. актуализируем схему ---
  await initDatabase();
  console.log("✓ Схема базы актуализирована");

  // --- 5. отчёт ---
  const client = createClient({
    url: DB_URL,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });
  const tables = [
    "users",
    "seasons",
    "chat_logs",
    "screenshots",
    "photos",
    "wall_posts",
    "audio_tracks",
    "player_stats",
    "player_inventories",
    "inventory_snapshots",
    "achievements",
    "friends",
    "mc_sessions",
  ];
  console.log("\nСтроки в таблицах:");
  for (const t of tables) {
    try {
      const r = await client.execute(`SELECT COUNT(*) AS c FROM ${t}`);
      console.log(`  ${t.padEnd(22)} ${r.rows[0]?.c ?? 0}`);
    } catch {
      console.log(`  ${t.padEnd(22)} — таблицы нет`);
    }
  }
  client.close();

  // Размер скопированной базы — для контроля, что файл не пустой.
  const size = statSync(dstDb).size;
  console.log(`\nРазмер базы: ${(size / 1024).toFixed(0)} КБ`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
