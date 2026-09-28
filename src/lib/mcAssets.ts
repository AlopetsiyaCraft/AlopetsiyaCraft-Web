/**
 * Картинки и русские имена предметов — из зеркала ванильных ассетов
 * (InventivetalentDev/minecraft-assets, версия 1.21.1).
 *
 * Иконки: модель предмета (assets/minecraft/models/item/<id>.json) указывает
 * текстуру (textures/item/... или textures/block/...), файл которой и отдаём
 * клиенту. Чтобы не дёргать GitHub на каждом запросе, результат кэшируется в
 * data/item-texture-cache-v2.json + data/texture-exists-cache.json; русские
 * имена из lang/ru_ru.json кэшируются в data/item-lang-ru.json. При неудаче
 * сети — fallback на имя, которое прислал сервер, и заглушку вместо иконки.
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { prettifyId } from "@/lib/inventory";

const ASSETS_VERSION = "1.21.1";
const ASSETS_BASE = `https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/${ASSETS_VERSION}/assets/minecraft/`;

const DATA_DIR = join(process.cwd(), "data");
const TEXTURE_CACHE_FILE = join(DATA_DIR, "item-texture-cache-v2.json");
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

/**
 * Как устроены модели в 1.21.1:
 *  - предметы: {"parent": "item/generated", "textures": {"layer0": "item/diamond"}};
 *  - блоки: item/<блок> обычно = {"parent": "block/<блок>"} — текстуры задаёт сам
 *    блок («all», либо «front»/«side»/«top», либо «end»/«side», ...), а шаблоны
 *    (cube_all, orientable, cube_column...) ссылаются на них через "#all".
 *
 * Раньше для блока с parent "block/<блок>" иконка бралась как "block/<блок>",
 * но такого png у большинства блоков нет (furnace, chest, hay_block,
 * dispenser...) — картинки пропадали. Теперь собираем текстуры по всей цепочке
 * родителей и выбираем характерную переменную (у предметов layer0; у блоков
 * all → front → top → side/end → particle), а существование файла проверяем
 * HEAD-запросом и кэшируем (png нет — предмет рисуется заглушкой).
 */
const TEXTURE_KEY_PRIORITY = [
  "layer0", "all", "front", "top", "side", "end", "particle",
  "north", "south", "east", "west", "up", "down", "bottom",
];

/** Модель, с ретраем на случай транзиентного сбоя сети (иначе null кэшируется надолго). */
async function fetchModelJson(modelName: string): Promise<Record<string, any> | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const model = await fetchJson(`${ASSETS_BASE}models/${modelName}.json`);
    if (model) return model;
  }
  return null;
}

async function collectModelChain(modelName: string): Promise<{
  merged: Record<string, string>;
  origins: Record<string, "item" | "block">;
} | null> {
  const merged: Record<string, string> = {};
  const origins: Record<string, "item" | "block"> = {};
  let cur: string | null = modelName;
  for (let i = 0; i <= 8 && cur; i++) {
    if (model404.has(cur)) break;
    const model = await fetchModelJson(cur);
    if (!model) {
      model404.add(cur);
      break;
    }
    const own = model.textures;
    if (own && typeof own === "object") {
      const folder: "item" | "block" = cur.startsWith("block/") ? "block" : "item";
      for (const [k, v] of Object.entries(own as Record<string, unknown>)) {
        if (typeof v === "string") {
          merged[k] = v;
          origins[k] = folder;
        }
      }
    }
    const parent = typeof model.parent === "string" ? model.parent : null;
    cur = parent ? parent.replace(/^minecraft:/, "") : null;
    // Шаблоны вне item//block/ (generated, handheld, builtin/entity...) — тупик.
    if (cur && !cur.startsWith("item/") && !cur.startsWith("block/")) cur = null;
  }
  return Object.keys(merged).length ? { merged, origins } : null;
}

/** Раскрывает ссылку "#переменная" в итоговом словаре текстур цепочки. */
function resolveTextureValue(merged: Record<string, string>, key: string): string | null {
  let v = merged[key];
  const seen = new Set<string>([key]);
  while (typeof v === "string" && v.startsWith("#")) {
    const next = v.slice(1);
    if (seen.has(next)) return null;
    seen.add(next);
    v = merged[next];
  }
  return typeof v === "string" ? v.replace(/^minecraft:/, "") : null;
}

/**
 * Путь текстуры из значения. Значения без "item/"/"block/" в ванили относительны
 * к папке модели, где заданы (у блоков → "block/<имя>", у предметов → "item/<имя>").
 */
function texturePathFromValue(
  value: string,
  origin: "item" | "block" | undefined
): string | null {
  const v = value.trim().replace(/^minecraft:/, "");
  if (/^(item|block)\//.test(v)) return v;
  return origin ? `${origin}/${v}` : null;
}

/** Лучшая текстура по модели предмета/блока (путь без .png), или null. */
async function resolveModelTexture(modelName: string): Promise<string | null> {
  const cacheKey = `model:${modelName}`;
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey)!;
  const chain = await collectModelChain(modelName);
  if (!chain) {
    textureCache.set(cacheKey, null);
    return null;
  }
  const { merged, origins } = chain;
  for (const key of TEXTURE_KEY_PRIORITY) {
    const value = resolveTextureValue(merged, key);
    if (!value) continue;
    const path = texturePathFromValue(value, origins[key]);
    // Проверяем существование файла — если кандидат не существует, пробуем следующий.
    if (path && (await textureFileExists(path))) {
      textureCache.set(cacheKey, path);
      return path;
    }
  }
  textureCache.set(cacheKey, null);
  return null;
}

// ---------- проверка существования файла текстуры ----------

const EXISTENCE_CACHE_FILE = join(DATA_DIR, "texture-exists-cache.json");
const existsInMemory = new Map<string, boolean>();
let existsOnDisk: Record<string, boolean> | null = null;

async function textureFileExists(texturePath: string): Promise<boolean> {
  if (existsInMemory.has(texturePath)) return existsInMemory.get(texturePath)!;
  if (existsOnDisk === null) {
    existsOnDisk = loadMapCache(EXISTENCE_CACHE_FILE) as unknown as Record<string, boolean>;
  }
  if (Object.prototype.hasOwnProperty.call(existsOnDisk, texturePath)) {
    const known = !!existsOnDisk[texturePath];
    existsInMemory.set(texturePath, known);
    return known;
  }
  let ok = false;
  try {
    const res = await fetch(`${ASSETS_BASE}textures/${texturePath}.png`, {
      method: "HEAD",
      cache: "no-store",
    });
    ok = res.ok;
  } catch {
    ok = false;
  }
  existsInMemory.set(texturePath, ok);
  existsOnDisk[texturePath] = ok;
  saveMapCache(EXISTENCE_CACHE_FILE, existsOnDisk as unknown as Record<string, string | null>);
  return ok;
}

/** Путь текстуры предмета относительно assets/minecraft/textures/ (без .png). */
export async function resolveItemTexture(itemId: string): Promise<string | null> {
  const id = itemId.includes(":") ? itemId.toLowerCase() : `minecraft:${itemId.toLowerCase()}`;
  if (textureCache.has(id)) return textureCache.get(id)!;

  // Сохранённый кэш с диска (item-texture-cache-v2.json).
  const disk = loadMapCache(TEXTURE_CACHE_FILE);
  if (Object.prototype.hasOwnProperty.call(disk, id)) {
    const v = disk[id];
    textureCache.set(id, v);
    return v;
  }

  let resolved: string | null = null;
  if (id.startsWith("minecraft:")) {
    const name = id.slice("minecraft:".length);
    resolved = await resolveModelTexture(`item/${name}`);
    if (!resolved) resolved = `item/${name}`; // на крайний случай — файл с именем предмета
    if (resolved && !(await textureFileExists(resolved))) resolved = null;
  }
  // Модный предмет: текстуры в зеркале нет — вернём ничего, отрисуем заглушку.

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