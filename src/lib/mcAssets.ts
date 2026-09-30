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
 *
 * Модные предметы (id с namespace != minecraft) в зеркале отсутствуют, поэтому
 * их ассеты читаются напрямую из .jar модов на диске (см. mcMods.ts) и
 * отдаются через /api/mc-texture/<ns>/<path>.png.
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { prettifyId } from "@/lib/inventory";
import {
  hasModCustomIcon,
  hasModModel,
  hasModTexture,
  readModModel,
} from "@/lib/mcMods";

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

// ---------- модные предметы: ассеты прямо из .jar ----------

/** Разбирает "ns:path" в пару; без namespace подставляется переданный. */
function splitRef(ref: string, defaultNs: string): { ns: string; path: string } {
  const clean = ref.trim().replace(/^#/, "");
  const i = clean.indexOf(":");
  if (i >= 0) return { ns: clean.slice(0, i), path: clean.slice(i + 1) };
  return { ns: defaultNs, path: clean };
}

/**
 * Шаблоны, которые сами текстур не задают: за их пределами цепочка родителей
 * не продолжается (в игре они только добавляют геометрию/отображения).
 */
function isTemplateModel(path: string): boolean {
  return (
    path.startsWith("builtin/") ||
    path === "item/generated" ||
    path === "item/handheld" ||
    path === "item/handheld_rod" ||
    path.startsWith("builtin")
  );
}

interface ModChain {
  /** Ключ текстуры → значение, как в JSON модели. */
  merged: Record<string, string>;
  /** Ключ текстуры → где задана (для относительных ссылок). */
  origins: Record<string, { ns: string; folder: "item" | "block" }>;
  /** Модель упёрлась в builtin/entity — предмет рисует сам мод, плоской текстуры нет. */
  builtinEntity: boolean;
}

/** Собирает текстуры по всей цепочке моделей мода (родители перекрывают детей). */
function collectModChain(ns: string, modelPath: string): ModChain | null {
  const merged: Record<string, string> = {};
  const origins: Record<string, { ns: string; folder: "item" | "block" }> = {};
  const seen = new Set<string>();
  let builtinEntity = false;
  let loaded = false;
  let cur: { ns: string; path: string } | null = { ns, path: modelPath };

  for (let depth = 0; depth <= 8 && cur; depth++) {
    const key = `${cur.ns}:${cur.path}`;
    if (seen.has(key)) break;
    seen.add(key);
    if (isTemplateModel(cur.path)) {
      // builtin/entity — в игре предмет рисует кастомный рендерер мода.
      if (cur.path.startsWith("builtin/entity")) builtinEntity = true;
      break;
    }

    const model = readModModel(cur.ns, cur.path);
    if (!model) break;
    loaded = true;

    const folder: "item" | "block" = cur.path.startsWith("block/") ? "block" : "item";
    const own = model.textures;
    if (own && typeof own === "object") {
      for (const [k, v] of Object.entries(own as Record<string, unknown>)) {
        if (typeof v === "string") {
          merged[k] = v;
          origins[k] = { ns: cur.ns, folder };
        }
      }
    }

    const parent = typeof model.parent === "string" ? model.parent : null;
    if (!parent) break;
    const p = splitRef(parent, cur.ns);
    // builtin/entity: в игре предмет рисует кастомный рендерер мода, своей
    // плоской текстуры нет. Проверяем до резолва — такой модели в jar нет.
    if (p.path.startsWith("builtin/")) {
      if (p.path === "builtin/entity") builtinEntity = true;
      break;
    }
    // Родитель без namespace ищется в namespace модели, затем в minecraft
    // (Blockbench часто пишет "item/generated" и ссылки на ванильные текстуры).
    const resolved = hasModModel(p.ns, p.path) ? p : { ns: "minecraft", path: p.path };
    cur = hasModModel(resolved.ns, resolved.path) ? resolved : null;
  }

  return loaded ? { merged, origins, builtinEntity } : null;
}

/** Раскрывает "#переменная" в итоговом словаре текстур цепочки. */
function resolveModTextureValue(chain: ModChain, key: string): { value: string; origin: { ns: string; folder: "item" | "block" } } | null {
  let name = key;
  const seen = new Set<string>();
  while (seen.has(name) === false) {
    seen.add(name);
    const raw = chain.merged[name];
    if (typeof raw !== "string") return null;
    if (raw.startsWith("#")) {
      name = raw.slice(1);
      continue;
    }
    const origin = chain.origins[name];
    if (!origin) return null;
    return { value: raw, origin };
  }
  return null;
}

/**
 * Ключи, по которым выбираем «характерную» текстуру. Числовые ключи ("0", "1"…)
 * — это слои Blockbench, причём больший номер рисуется поверх, поэтому берём
 * максимальный (у пива это наполнение, а не пустое стекло).
 */
function modPriorityKeys(merged: Record<string, string>): string[] {
  const keys = new Set<string>();
  for (const k of ["layer0", "all", "front", "top", "side", "end"]) {
    if (typeof merged[k] === "string") keys.add(k);
  }
  const numeric = Object.keys(merged)
    .filter((k) => /^\d+$/.test(k))
    .sort((a, b) => Number(b) - Number(a));
  for (const k of numeric) keys.add(k);
  for (const k of ["planks", "log", "particle", "north", "south", "east", "west", "up", "down", "bottom"]) {
    if (typeof merged[k] === "string") keys.add(k);
  }
  // Остальное — по порядку объявления, чтобы иконка точно нашлась.
  for (const k of Object.keys(merged)) keys.add(k);
  return [...keys];
}

/** Приводит значение текстуры к паре namespace + путь относительно textures/. */
function normalizeModTextureRef(
  value: string,
  origin: { ns: string; folder: "item" | "block" }
): { ns: string; path: string } {
  const ref = splitRef(value, origin.ns);
  const path = /^(item|block)\//.test(ref.path) ? ref.path : `${origin.folder}/${ref.path}`;
  return { ns: ref.ns, path };
}

/**
 * Текстура мода. Возвращает готовую ссылку кэша: "mod:<ns>:<path>" — наш PNG
 * из jar, "van:<path>" — ванильная текстура из зеркала.
 *
 * Blockbench часто пишет ссылки на ванильные текстуры без namespace ("block/
 * hay_block_side") — в моде их нет, поэтому проверяем мод, а затем ваниль.
 */
async function pickModTexture(chain: ModChain): Promise<string | null> {
  for (const key of modPriorityKeys(chain.merged)) {
    const resolved = resolveModTextureValue(chain, key);
    if (!resolved) continue;
    const ref = normalizeModTextureRef(resolved.value, resolved.origin);
    if (ref.ns === "minecraft") {
      if (await textureFileExists(ref.path)) return `van:${ref.path}`;
      continue;
    }
    if (hasModTexture(ref.ns, ref.path)) return `mod:${ref.ns}:${ref.path}`;
    // Ссылка без namespace указывает на ванильную текстуру.
    if (await textureFileExists(ref.path)) return `van:${ref.path}`;
  }
  return null;
}

// ---------- кодирование иконки в строку кэша ----------

/**
 * Иконка хранится строкой: "van:item/diamond" — ванильная текстура из зеркала,
 * "mod:charta:block/dealer_table" — текстура из jar мода,
 * "icon:charta:deck" — картинка, которой мод рисует предмет сам (builtin/entity).
 * Старые записи кэша без префикса считаем ванильными.
 */
export function itemIconUrl(textureRef: string | null): string | null {
  if (!textureRef) return null;
  if (textureRef.startsWith("van:")) return `${ASSETS_BASE}textures/${textureRef.slice(4)}.png`;
  if (textureRef.startsWith("mod:")) {
    const rest = textureRef.slice(4);
    const i = rest.indexOf(":");
    if (i < 0) return null;
    const ns = rest.slice(0, i);
    const path = rest.slice(i + 1);
    if (!/^[a-z0-9_.-]+$/.test(ns)) return null;
    const safe = path
      .split("/")
      .map((seg) => (seg === ".." || seg === "." ? "" : seg))
      .filter(Boolean)
      .join("/");
    if (!safe) return null;
    return `/api/mc-texture/${ns}/${safe}.png`;
  }
  if (textureRef.startsWith("icon:")) {
    const rest = textureRef.slice(5);
    const i = rest.indexOf(":");
    if (i < 0) return null;
    return `/api/mc-texture/${rest.slice(0, i)}/_icon/${rest.slice(i + 1)}.png`;
  }
  // Legacy: голый путь ванильной текстуры.
  return `${ASSETS_BASE}textures/${textureRef}.png`;
}

/** Путь текстуры предмета: "van:…", "mod:…" или "icon:…" (null — иконки нет). */
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
    const path = await resolveModelTexture(`item/${name}`);
    if (path && (await textureFileExists(path))) resolved = `van:${path}`;
  } else {
    // Модный предмет: читаем модель и текстуру из jar мода.
    const ns = id.slice(0, id.indexOf(":"));
    const name = id.slice(id.indexOf(":") + 1);
    const chain = collectModChain(ns, `item/${name}`);
    if (chain) {
      resolved = await pickModTexture(chain);
      // builtin/entity (charta:deck и подобные): плоской текстуры нет — берём
      // ту картинку, которой мод рисует предмет сам.
      if (!resolved && chain.builtinEntity && hasModCustomIcon(ns, name)) {
        resolved = `icon:${ns}:${name}`;
      }
    }
  }

  textureCache.set(id, resolved);
  disk[id] = resolved;
  saveMapCache(TEXTURE_CACHE_FILE, disk);
  return resolved;
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