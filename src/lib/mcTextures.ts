/**
 * Пиксели текстур: из .jar модов или из зеркала ванильных ассетов.
 *
 * Два источника, один результат — RGBA-буфер плюс размеры. Всё складывается в
 * data/textures/, чтобы не дёргать GitHub и не распаковывать jar на каждом
 * запросе: после первого обращения текстура читается с диска.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import sharp from "sharp";
import { readModTexture } from "@/lib/mcMods";

const ASSETS_BASE = `https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.21.1/assets/minecraft/`;
const TEXTURE_DIR = join(process.cwd(), "data", "textures");

/** Распакованная текстура: RGBA, по 4 байта на пиксель. */
export interface TexturePixels {
  width: number;
  height: number;
  /** RGBA, длина = width * height * 4. */
  data: Buffer;
}

/** Кэш распакованных текстур в памяти. */
const pixelsCache = new Map<string, TexturePixels>();
/** Неудачи тоже запоминаем, чтобы не бить по отсутствующим файлам. */
const missingCache = new Set<string>();

function cacheKey(ns: string, path: string): string {
  return `${ns}/${path}`;
}

function diskPath(ns: string, path: string): string {
  return join(TEXTURE_DIR, ...cacheKey(ns, path).split("/")) + ".png";
}

/** Декодирует PNG в RGBA. */
async function decode(buf: Buffer): Promise<TexturePixels | null> {
  try {
    const { data, info } = await sharp(buf)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    return { width: info.width, height: info.height, data };
  } catch {
    return null;
  }
}

/** Кладёт распакованные пиксели в PNG на диск (кэш переживает рестарт). */
async function storeOnDisk(ns: string, path: string, buf: Buffer): Promise<void> {
  try {
    const file = diskPath(ns, path);
    mkdirSync(dirname(file), { recursive: true });
    await sharp(buf).png({ compressionLevel: 9 }).toFile(file);
  } catch {
    // кэш — вещь необязательная
  }
}

/** Пиксели текстуры <ns>:<path> (path относительно textures/, без .png). */
export async function getTexturePixels(ns: string, path: string): Promise<TexturePixels | null> {
  const key = cacheKey(ns, path);
  const cached = pixelsCache.get(key);
  if (cached) return cached;
  if (missingCache.has(key)) return null;

  // 1. Распакованный кэш с диска.
  const file = diskPath(ns, path);
  if (existsSync(file)) {
    const decoded = await decode(readFileSync(file));
    if (decoded) {
      pixelsCache.set(key, decoded);
      return decoded;
    }
  }

  // 2. Мод — читаем из jar.
  if (ns !== "minecraft") {
    const raw = readModTexture(ns, path);
    if (raw) {
      const decoded = await decode(raw);
      if (decoded) {
        pixelsCache.set(key, decoded);
        void storeOnDisk(ns, path, raw);
        return decoded;
      }
    }
    missingCache.add(key);
    return null;
  }

  // 3. Ванильная — из зеркала ассетов.
  try {
    const res = await fetch(`${ASSETS_BASE}textures/${path}.png`, { cache: "no-store" });
    if (!res.ok) {
      missingCache.add(key);
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const decoded = await decode(buf);
    if (!decoded) {
      missingCache.add(key);
      return null;
    }
    pixelsCache.set(key, decoded);
    void storeOnDisk(ns, path, buf);
    return decoded;
  } catch {
    missingCache.add(key);
    return null;
  }
}

/**
 * Пиксели по ссылке на текстуру из JSON модели.
 *
 * Без namespace игра читает ванильную (SpriteId.parse подставляет "minecraft"),
 * поэтому блокбеш-ссылка вида "block/oak_planks" внутри модели мода — это
 * именно ванильная текстура. Так и делаем, иначе модные блоки в игре были бы
 * без текстур вовсе.
 */
export async function getTextureByRef(ref: string): Promise<TexturePixels | null> {
  const clean = ref.trim().replace(/^#/, "");
  if (!clean) return null;
  const i = clean.indexOf(":");
  if (i < 0) return getTexturePixels("minecraft", clean);
  return getTexturePixels(clean.slice(0, i), clean.slice(i + 1));
}

/**
 * Картинка из jar мода по произвольному пути внутри архива — для файлов вне
 * assets/<ns>/textures/ (charta: decks/flags/russia.png и подобные).
 */
export async function getModFile(ns: string, path: string): Promise<TexturePixels | null> {
  const key = `jar/${ns}/${path}`;
  const cached = pixelsCache.get(key);
  if (cached) return cached;
  if (missingCache.has(key)) return null;

  const raw = readModTexture(ns, path);
  if (!raw) {
    missingCache.add(key);
    return null;
  }
  const decoded = await decode(raw);
  if (!decoded) {
    missingCache.add(key);
    return null;
  }
  pixelsCache.set(key, decoded);
  void storeOnDisk(`jar/${ns}`, path, raw);
  return decoded;
}