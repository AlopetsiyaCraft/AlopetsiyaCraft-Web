/**
 * Картинки и русские имена предметов — из зеркала ванильных ассетов
 * (InventivetalentDev/minecraft-assets, версия 1.21.1).
 *
 * Иконки: модель предмета (assets/minecraft/models/item/<id>.json) указывает
 * текстуру (textures/item/... или textures/block/...), файл которой и отдаём
 * клиенту. Чтобы не дёргать GitHub на каждом запросе, результат кэшируется в
 * data/item-texture-cache.json; русские имена из lang/ru_ru.json кэшируются в
 * data/item-lang-ru.json. Настройки сети при неудаче — просто fallback на имя,
 * которое прислал сервер, и «угаданную» текстуру.
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { prettifyId } from "@/lib/inventory";

const ASSETS_VERSION = "1.21.1";
const ASSETS_BASE = `https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/${ASSETS_VERSION}/assets/minecraft/`;

const DATA_DIR = join(process.cwd(), "data");
const TEXTURE_CACHE_FILE = join(DATA_DIR, "item-texture-cache.json");
const LANG_CACHE_FILE = join(DATA_DIR, "item-lang-ru.json");
const EN_CACHE_FILE = join(DATA_DIR, "item-lang-en.json");

/** Как долго живёт кэш русских имён (обновляем не чаще раза в сутки). */
const LANG_TTL_MS = 24 * 60 * 60 * 1000;

// ---------- маленький кэш в памяти ----------

const textureCache = new Map<string, string | null>();
const model404 = new Set<string>();
let ruLang: Record<string, string> | null | undefined; // undefined = ещё не грузили

// ---------- файловый кэш ----------

function ensureDataDir() {
  mkdirSync(DATA_DIR, { recursive: true });
}

function loadMapCache(file: string): Record<string, string | null> {
  try {
    if (existsSync(file)) {
      const parsed = JSON.parse(readFileSync(file, "utf8"));
      return parsed && typeof parsed === "object" ? parsed : {};
    }
  } catch {
    // битый кэш — пересоздадим
  }
  return {};
}

function saveMapCache(file: string, map: Record<string, string | null>) {
  try {
    ensureDataDir();
    writeFileSync(file, JSON.stringify(map));
  } catch {
    // некритично
  }
}

// ---------- HTTP ----------

async function fetchText(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url: string): Promise<Record<string, any> | null> {
  const text = await fetchText(url);
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

// ---------- русские имена (lang/ru_ru.json) ----------

export type ItemLang = Record<string, string>;

let persistentRu: { map: ItemLang; fetchedAt: number } | null = null;

async function loadRuLang(): Promise<ItemLang> {
  if (ruLang !== undefined && ruLang !== null) return ruLang;

  // Из файла-кэша (если не протух).
  try {
    if (persistentRu === null && existsSync(LANG_CACHE_FILE)) {
      const parsed = JSON.parse(readFileSync(LANG_CACHE_FILE, "utf8"));
      if (parsed && typeof parsed.map === "object" && Date.now() - parsed.fetchedAt < LANG_TTL_MS) {
        persistentRu = parsed;
      }
    }
  } catch {
    // ignore
  }

  if (persistentRu === null) {
    const json = await fetchJson(`${ASSETS_BASE}lang/ru_ru.json`);
    if (json) {
      const map: ItemLang = {};
      for (const [key, value] of Object.entries(json)) {
        if (typeof value === "string") map[key] = value;
      }
      persistentRu = { map, fetchedAt: Date.now() };
      try {
        ensureDataDir();
        writeFileSync(LANG_CACHE_FILE, JSON.stringify(persistentRu));
      } catch {
        // ignore
      }
    } else {
      // Сеть недоступна — запоминаем пустой словарь на этот запуск, чтобы не
      // долбить GitHub каждым предметом.
      persistentRu = { map: {}, fetchedAt: Date.now() };
    }
  }

  ruLang = persistentRu.map;
  return ruLang;
}

/** Русское имя предмета по registry id (fallback — имя с сервера/красивое id). */
export async function localizeItem(id: string, fallback: string): Promise<string> {
  const lang = await loadRuLang();
  if (!id.includes(":")) return fallback;
  const name = id.split(":")[1]!;
  return (
    lang[`item.minecraft.${name}`] ??
    lang[`block.minecraft.${name}`] ??
    fallback
  );
}

/** Русское имя заклинания по registry id, или null. */
export async function localizeEnchantment(rawId: string): Promise<string | null> {
  const id = rawId.includes(":") ? rawId.split(":")[1]! : rawId;
  const lang = await loadRuLang();
  return lang[`enchantment.minecraft.${id}`] ?? null;
}

// ---------- английские имена (для определения кастомных имён) ----------

let persistentEn: { map: ItemLang; fetchedAt: number } | null = null;
let enLang: ItemLang | null | undefined; // undefined = ещё не грузили

/** Словарь en_us.json (кэш на диске, обновляется раз в сутки). */
async function loadEnLang(): Promise<ItemLang> {
  if (enLang !== undefined && enLang !== null) return enLang;

  try {
    if (persistentEn === null && existsSync(EN_CACHE_FILE)) {
      const parsed = JSON.parse(readFileSync(EN_CACHE_FILE, "utf8"));
      if (parsed && typeof parsed.map === "object" && Date.now() - parsed.fetchedAt < LANG_TTL_MS) {
        persistentEn = parsed;
      }
    }
  } catch {
    // битый кэш — пересоздадим
  }

  if (persistentEn === null) {
    const json = await fetchJson(`${ASSETS_BASE}lang/en_us.json`);
    if (json) {
      const map: ItemLang = {};
      for (const [key, value] of Object.entries(json)) {
        if (typeof value === "string") map[key] = value;
      }
      persistentEn = { map, fetchedAt: Date.now() };
      try {
        ensureDataDir();
        writeFileSync(EN_CACHE_FILE, JSON.stringify(persistentEn));
      } catch {
        // ignore
      }
    } else {
      persistentEn = { map: {}, fetchedAt: Date.now() };
    }
  }

  enLang = persistentEn.map;
  return enLang;
}

/**
 * Имя предмета для показа. У ванильных предметов с «дефолтным» именем (как
 * прислал сервер на en_us — ничем не отличается от справочника) показываем
 * русский перевод. Кастомные имена (переименовано на наковальне) и модные
 * предметы без перевода оставляем как прислал сервер.
 */
export async function localizeItemSmart(id: string, serverName: string): Promise<string> {
  if (!id.includes(":")) return serverName || id;
  const [ru, en] = await Promise.all([localizeItem(id, ""), loadEnLang()]);
  const name = id.split(":")[1]!;
  const enDefault = en?.[`item.minecraft.${name}`] ?? en?.[`block.minecraft.${name}`] ?? null;

  const server = serverName.trim();
  const prettified = prettifyId(id);
  const isDefaultName =
    (enDefault !== null && server.toLowerCase() === enDefault.toLowerCase()) ||
    (enDefault === null && server.toLowerCase() === prettified.toLowerCase());

  // Кастомное имя — оставляем как есть; дефолтное — заменяем на русское.
  if (isDefaultName) return ru || serverName;
  return serverName;
}

// ---------- текстуры предметов (модель → путь текстуры) ----------

function guessTexturePath(name: string): string {
  // Для большинства предметов файл текстуры совпадает с id.
  return `item/${name}`;
}

async function resolveModelTexture(modelName: string, depth: number): Promise<string | null> {
  if (depth > 6) return null;
  const cacheKey = `model:${modelName}`;
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey)!;
  if (model404.has(modelName)) return null;

  const model = await fetchJson(`${ASSETS_BASE}models/${modelName}.json`);
  if (!model) {
    model404.add(modelName);
    return null;
  }

  // Текстуры из самой модели (самый надёжный случай).
  const textures = model.textures;
  if (textures && typeof textures === "object") {
    const layer0 = textures["layer0"];
    const all = textures["all"];
    const first = Object.values(textures as Record<string, string>)[0];
    const pick = (layer0 ?? all ?? first) as string | undefined;
    if (pick && typeof pick === "string") {
      const path = normalizeTexture(pick);
      if (path) {
        textureCache.set(cacheKey, path);
        return path;
      }
    }
  }

  let parent = typeof model.parent === "string" ? model.parent : null;
  if (!parent) return null;
  const norm = normalizeTexture(parent);
  if (!norm) return null;

  // parent вида "block/cube_all" → текстура = та же блочная модель (обычно у
  // предмета уже есть override textures; если нет — берём картинку блока).
  if (norm.startsWith("block/")) {
    textureCache.set(cacheKey, norm);
    return norm;
  }

  // Проваливаемся дальше по цепочке parent-ов.
  const next = await resolveModelTexture(norm.replace(/^minecraft:/, ""), depth + 1);
  textureCache.set(cacheKey, next);
  return next;
}

/** Убирает namespace/алиасы, оставляет путь вида "item/foo" или "block/foo". */
function normalizeTexture(value: string): string | null {
  let v = value.trim();
  if (v.startsWith("minecraft:")) v = v.slice("minecraft:".length);
  if (v.startsWith("item/") || v.startsWith("block/")) return v;
  return null;
}

/** Путь текстуры предмета относительно assets/minecraft/textures/ (без .png). */
export async function resolveItemTexture(itemId: string): Promise<string | null> {
  const id = itemId.includes(":") ? itemId.toLowerCase() : `minecraft:${itemId.toLowerCase()}`;
  if (textureCache.has(id)) return textureCache.get(id)!;

  // Сохранённый кэш с диска.
  const disk = loadMapCache(TEXTURE_CACHE_FILE);
  if (Object.prototype.hasOwnProperty.call(disk, id)) {
    const v = disk[id];
    textureCache.set(id, v);
    return v;
  }

  let resolved: string | null = null;
  if (id.startsWith("minecraft:")) {
    const name = id.slice("minecraft:".length);
    // У многих предметов модель прямо ссылается на текстуру.
    resolved = await resolveModelTexture(`item/${name}`, 0);
    if (!resolved) resolved = guessTexturePath(name);
  } else {
    // Модный предмет: текстуры в зеркале нет — вернём ничего, отрисуем заглушку.
    resolved = null;
  }

  textureCache.set(id, resolved);
  disk[id] = resolved;
  saveMapCache(TEXTURE_CACHE_FILE, disk);
  return resolved;
}

/** Полный URL картинки предмета (или null — предмет не рисуется). */
export function itemIconUrl(texturePath: string | null): string | null {
  if (!texturePath) return null;
  return `${ASSETS_BASE}textures/${texturePath}.png`;
}

/** Резолвит иконки для пачки id параллельно (6 воркеров, кэш на диске). */
export async function resolveItemIcons(itemIds: string[]): Promise<Map<string, string | null>> {
  const unique = [...new Set(itemIds.map((i) => i.toLowerCase()))];
  const result = new Map<string, string | null>();
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(6, unique.length)) }, async () => {
    while (cursor < unique.length) {
      const id = unique[cursor++];
      const path = await resolveItemTexture(id);
      result.set(id, itemIconUrl(path));
    }
  });
  await Promise.all(workers);
  return result;
}