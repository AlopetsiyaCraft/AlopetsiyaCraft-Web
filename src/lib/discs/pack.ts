import { createHash } from "crypto";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import sharp from "sharp";
import { zipSync } from "fflate";
import { asc, isNotNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { audioTracks } from "@/lib/db/schema";
import { coverFilePath, coverPixelFilePath } from "@/lib/audio";

/**
 * Сборка динамического ресурспака с пиксельными обложками пластинок.
 *
 * Структура пака (pack_format 34 — Minecraft 1.21.1):
 *  - pack.mcmeta
 *  - assets/minecraft/models/item/music_disc_13.json — «индекс»: ванильная
 *    модель диска 13 + overrides по custom_model_data (id трека)
 *  - assets/alopetsiyacraft/models/item/disc/<id>.json — 3D-модель винила
 *    (шаблон из ресурспака Custom Discs and Covers), грань = обложка трека
 *  - assets/alopetsiyacraft/textures/item/disc/<id>.png — пиксельная обложка 16×16
 *  - assets/alopetsiyacraft/textures/item/do_not_remove.png — «виниловое тело» 32×32
 *
 * Пак пересобирается только когда меняется набор треков с обложками (count/max id),
 * остальное время отдаётся из кэша.
 */

const PACK_FORMAT = 34;
const INDEX_MODEL = "assets/minecraft/models/item/music_disc_13.json";
const VINYL_TEXTURE = "assets/alopetsiyacraft/textures/item/do_not_remove.png";
const VINYL_MODEL_PATH = "alopetsiyacraft:item/do_not_remove";

export interface DiscPackInfo {
  /** SHA-1 зипа — по нему клиент понимает, качать ли пак заново. */
  hash: string;
  buffer: Buffer;
  /** Сколько дисков с обложками попало в пак. */
  trackCount: number;
}

let cache: { key: string; info: DiscPackInfo } | null = null;

/** Лёгкий ключ версии: количество треков с обложками + максимальный id. */
async function sourceKey(): Promise<string> {
  const row = await db
    .select({
      count: sql<number>`COUNT(*)`,
      maxId: sql<number | null>`MAX(${audioTracks.id})`,
    })
    .from(audioTracks)
    .where(isNotNull(audioTracks.coverFileName))
    .get();
  return `${row?.count ?? 0}:${row?.maxId ?? 0}`;
}

function str(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

export async function buildDiscPack(): Promise<DiscPackInfo> {
  const key = await sourceKey();
  if (cache && cache.key === key) {
    return cache.info;
  }

  const tracks = await db
    .select({
      id: audioTracks.id,
      userId: audioTracks.userId,
      coverFileName: audioTracks.coverFileName,
    })
    .from(audioTracks)
    .where(isNotNull(audioTracks.coverFileName))
    .orderBy(asc(audioTracks.id))
    .all();

  const [modelTpl, vinylTpl] = await Promise.all([
    readFile(join(process.cwd(), "src/lib/discs/templates/disc-model.json"), "utf8"),
    readFile(join(process.cwd(), "src/lib/discs/templates/do_not_remove.png")),
  ]);

  const files: Record<string, Uint8Array> = {
    "pack.mcmeta": str(
      JSON.stringify({
        pack: {
          description: "AlopetsiyaCraft: пиксельные обложки пластинок",
          pack_format: PACK_FORMAT,
        },
      })
    ),
    [VINYL_TEXTURE]: new Uint8Array(vinylTpl),
  };

  const overrides: { id: number }[] = [];
  for (const t of tracks) {
    const coverPath = coverFilePath(t.userId, t.coverFileName as string);
    let png: Buffer;
    try {
      // Пиксельная 16×16 для текстуры диска: берём готовый файл (если есть)
      // либо генерируем из оригинала через sharp и сохраняем рядом.
      const pixelPath = coverPixelFilePath(t.userId, t.coverFileName as string);
      try {
        png = await readFile(pixelPath);
      } catch {
        const original = await readFile(coverPath);
        png = await sharp(original).resize(16, 16, { fit: "cover" }).png().toBuffer();
        await writeFile(pixelPath, png);
      }
    } catch {
      continue; // файл обложки пропал или не читается — пропускаем трек
    }
    const model = modelTpl
      .replace('"1": "item/13"', `"1": "alopetsiyacraft:item/disc/${t.id}"`)
      .replace('"0": "item/do_not_remove"', `"0": "${VINYL_MODEL_PATH}"`);
    files[`assets/alopetsiyacraft/models/item/disc/${t.id}.json`] = str(model);
    files[`assets/alopetsiyacraft/textures/item/disc/${t.id}.png`] = new Uint8Array(png);
    overrides.push({ id: t.id });
  }

  const indexModel = {
    parent: "minecraft:item/generated",
    textures: { layer0: "minecraft:item/music_disc_13" },
    overrides: overrides.map((o) => ({
      predicate: { custom_model_data: o.id },
      model: `alopetsiyacraft:item/disc/${o.id}`,
    })),
  };
  files[INDEX_MODEL] = str(JSON.stringify(indexModel, null, 2));

  const zipped = zipSync(files, { level: 0 });
  const buffer = Buffer.from(zipped);
  const hash = createHash("sha1").update(buffer).digest("hex");

  const info: DiscPackInfo = { hash, buffer, trackCount: overrides.length };
  cache = { key, info };
  return info;
}