/**
 * Ассеты модов прямо из .jar на диске.
 *
 * Сайт и сервер Minecraft лежат на одной машине, поэтому текстуры/модели модов
 * читаются из jar-файлов папки mods (по умолчанию — папка сервера AlopetsiyaCraft,
 * путь можно переопределить переменной окружения MC_MODS_DIR).
 *
 * Чтение: zip разбирается вручную (End of Central Directory → Central Directory),
 * без распаковки лишнего — в памяти держится только нужный файл. Модели и
 * текстуры кэшируются в памяти процесса; индекс пересобирается, если изменились
 * mtime/размер jar-файлов.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { inflateRawSync } from "zlib";

const DEFAULT_MODS_DIR = "D:\\Games\\Minecraft\\Servers\\AlopetsiyaCraft Season4\\mods";

/** Папка с jar-файлами модов (MC_MODS_DIR в .env переопределяет). */
export const MODS_DIR = process.env.MC_MODS_DIR || DEFAULT_MODS_DIR;

// ---------- чтение zip ----------

interface ZipEntry {
  /** Смещение локального заголовка файла внутри jar. */
  offset: number;
  /** 0 — без сжатия, 8 — deflate. */
  method: number;
  /** Размер сжатых данных. */
  compressedSize: number;
}

interface JarFile {
  /** Полный путь к jar. */
  path: string;
  /** mtime + размер: ключ актуальности кэшей. */
  stamp: string;
  /** Имя записи → данные заголовка. */
  entries: Map<string, ZipEntry>;
  /** Содержимое jar в памяти (лениво, с ограничением по числу файлов). */
  buf: Buffer | null;
}

function stampOf(file: string): string {
  const st = statSync(file);
  return `${st.mtimeMs}:${st.size}`;
}

/** Кэш открытых jar: путь → данные. Ограничен, чтобы не съесть память. */
const MAX_CACHED_JARS = 6;
const jars = new Map<string, JarFile>();

function forgetStale(path: string) {
  for (const [key, jar] of jars) {
    if (jar.path === path) jars.delete(key);
  }
}

/** Читает zip-каталог jar-файла (список записей без распаковки). */
function openJar(path: string): JarFile | null {
  const stamp = stampOf(path);
  for (const jar of jars.values()) {
    if (jar.path === path && jar.stamp === stamp) return jar;
  }
  forgetStale(path);

  let buf: Buffer;
  try {
    buf = readFileSync(path);
  } catch {
    return null;
  }

  const entries = new Map<string, ZipEntry>();

  // End of Central Directory: сигнатура PK\005\006, ищем с конца файла.
  let eocd = -1;
  const minPos = Math.max(0, buf.length - 65557);
  for (let i = buf.length - 22; i >= minPos; i--) {
    if (buf[i] === 0x50 && buf[i + 1] === 0x4b && buf[i + 2] === 0x05 && buf[i + 3] === 0x06) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) {
    const jar: JarFile = { path, stamp, entries, buf };
    jars.set(`${path}|${stamp}`, jar);
    return jar;
  }

  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);

  for (let i = 0; i < count; i++) {
    if (p + 46 > buf.length) break;
    // Central file header: PK\001\002
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const compressedSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const offset = buf.readUInt32LE(p + 42);
    if (p + 46 + nameLen > buf.length) break;
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    if (name) entries.set(name, { offset, method, compressedSize });
    p += 46 + nameLen + extraLen + commentLen;
  }

  const jar: JarFile = { path, stamp, entries, buf };
  jars.set(`${path}|${stamp}`, jar);
  while (jars.size > MAX_CACHED_JARS) {
    const oldest = jars.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    jars.delete(oldest);
  }
  return jar;
}

/** Достаёт содержимое одной записи zip (нужен буфер jar в памяти). */
function readEntry(jar: JarFile, name: string): Buffer | null {
  const entry = jar.entries.get(name);
  if (!entry) return null;
  const buf = jar.buf;
  if (!buf) return null;
  const headerAt = entry.offset;
  if (headerAt + 30 > buf.length) return null;
  // Local file header: PK\003\004
  if (buf.readUInt32LE(headerAt) !== 0x04034b50) return null;
  const nameLen = buf.readUInt16LE(headerAt + 26);
  const extraLen = buf.readUInt16LE(headerAt + 28);
  const start = headerAt + 30 + nameLen + extraLen;
  const end = start + entry.compressedSize;
  if (end > buf.length) return null;
  const raw = buf.subarray(start, end);
  if (entry.method === 0) return raw;
  if (entry.method === 8) {
    try {
      return inflateRawSync(raw);
    } catch {
      return null;
    }
  }
  return null;
}

// ---------- индекс namespace → ассеты ----------

export interface NamespaceAssets {
  /** "item/deck" → jar. */
  models: Map<string, string>;
  /** "block/oak_planks" → jar. */
  textures: Map<string, string>;
  /** Файлы вне assets/: "decks/standard/blue" → jar (картинки колод у charta). */
  extra: Map<string, string>;
  /** "decks/flags/russia.json" → jar (описания колод в data/<ns>/). */
  dataFiles: Map<string, string>;
  /** Языковые файлы мода: путь внутри jar → jar. */
  langFiles: Map<string, string>;
}

let indexCache: { stamp: string; data: Map<string, NamespaceAssets> } | null = null;

/**
 * Как часто перепроверяем папку модов. Запросов к роуту много, а stat по всем
 * jar на каждый раз — лишняя работа; за изменения модов достаточно секунды.
 */
const INDEX_STAMP_TTL_MS = 1000;
let lastStampCheck = 0;
let lastStamp = "";

/** Сигнатура папки модов: список jar + их mtime/размер. */
function modsStamp(): string {
  const now = Date.now();
  if (now - lastStampCheck < INDEX_STAMP_TTL_MS && lastStamp) return lastStamp;
  lastStampCheck = now;
  lastStamp = computeModsStamp();
  return lastStamp;
}

function computeModsStamp(): string {
  if (!existsSync(MODS_DIR)) return "no-mods-dir";
  try {
    return readdirSync(MODS_DIR)
      .filter((f) => f.endsWith(".jar"))
      .sort()
      .map((f) => {
        try {
          return `${f}:${stampOf(join(MODS_DIR, f))}`;
        } catch {
          return `${f}:missing`;
        }
      })
      .join("|");
  } catch {
    return "error";
  }
}

/** Строит (или отдаёт из кэша) индекс ассетов всех модов. */
export function getModIndex(): Map<string, NamespaceAssets> {
  const stamp = modsStamp();
  if (indexCache && indexCache.stamp === stamp) return indexCache.data;

  const data = new Map<string, NamespaceAssets>();

  const ensure = (ns: string): NamespaceAssets => {
    let na = data.get(ns);
    if (!na) {
      na = { models: new Map(), textures: new Map(), extra: new Map(), dataFiles: new Map(), langFiles: new Map() };
      data.set(ns, na);
    }
    return na;
  };

  if (existsSync(MODS_DIR)) {
    for (const file of readdirSync(MODS_DIR).filter((f) => f.endsWith(".jar"))) {
      const jarPath = join(MODS_DIR, file);
      let jar: JarFile | null;
      try {
        jar = openJar(jarPath);
      } catch {
        continue;
      }
      if (!jar) continue;

      // namespace из META-INF/neoforge.mods.toml / mods.toml: проще всего взять
      // первый namespace, реально найденный в assets/<ns>/.
      for (const name of jar.entries.keys()) {
        const parts = name.split("/");
        if (parts.length < 3) continue;
        const ns = parts[1];
        if (!ns || ns.includes(".")) continue;

        if (parts[0] === "assets") {
          // assets/<ns>/models/<path>.json
          if (parts[2] === "models" && name.endsWith(".json")) {
            const rel = parts.slice(3).join("/").replace(/\.json$/, "");
            const na = ensure(ns);
            if (!na.models.has(rel)) na.models.set(rel, jarPath);
            continue;
          }
          // assets/<ns>/textures/<path>.png
          if (parts[2] === "textures" && name.endsWith(".png")) {
            const rel = parts.slice(3).join("/").replace(/\.png$/, "");
            const na = ensure(ns);
            if (!na.textures.has(rel)) na.textures.set(rel, jarPath);
            continue;
          }
          // assets/<ns>/lang/<lang>.json — названия предметов и колод.
          if (parts[2] === "lang" && name.endsWith(".json")) {
            const na = ensure(ns);
            if (!na.langFiles.has(name)) na.langFiles.set(name, jarPath);
          }
          continue;
        }

        // data/<ns>/... — описания предметов (нужны, чтобы отличить варианты
        // одного предмета, например разные колоды charta по названию стека).
        // Ключ — путь относительно data/<ns>/: "decks/flags/russia".
        if (parts[0] === "data" && name.endsWith(".json")) {
          const rel = parts.slice(2).join("/").replace(/\.json$/, "");
          const na = ensure(ns);
          if (!na.dataFiles.has(rel)) na.dataFiles.set(rel, jarPath);
        }
      }

      // Файлы вне assets/ — картинки, которые мод читает сам из jar
      // (charta: decks/*.png — обложки колод для рендера DeckItemRenderer).
      const extraEntries = [...jar.entries.keys()].filter((n) => n.startsWith("decks/") && n.endsWith(".png"));
      if (extraEntries.length) {
        // namespace: ищем по наличию assets/<ns>/models/item/deck.json
        const ns = [...data.keys()].find((candidate) => data.get(candidate)!.models.has("item/deck"));
        if (ns) {
          const na = ensure(ns);
          for (const name of extraEntries) {
            const rel = name.replace(/\.png$/, "");
            if (!na.extra.has(rel)) na.extra.set(rel, jarPath);
          }
        }
      }
    }
  }

  indexCache = { stamp, data };
  return data;
}

// ---------- публичные функции доступа ----------

function readFromJar(jarPath: string, entryName: string): Buffer | null {
  try {
    const jar = openJar(jarPath);
    if (!jar) return null;
    return readEntry(jar, entryName);
  } catch {
    return null;
  }
}

/** Есть ли в модах текстура <ns>:<path> (path без .png). */
export function hasModTexture(ns: string, path: string): boolean {
  const na = getModIndex().get(ns);
  if (!na) return false;
  return na.textures.has(path) || na.extra.has(path);
}

/** Есть ли в модах модель <ns>:<path> (path без .json). */
export function hasModModel(ns: string, path: string): boolean {
  const na = getModIndex().get(ns);
  if (!na) return false;
  return na.models.has(path);
}

/** JSON модели из jar (или null). */
export function readModModel(ns: string, path: string): Record<string, unknown> | null {
  const na = getModIndex().get(ns);
  if (!na) return null;
  const jarPath = na.models.get(path);
  if (!jarPath) return null;
  const buf = readFromJar(jarPath, `assets/${ns}/models/${path}.json`);
  if (!buf) return null;
  try {
    const parsed = JSON.parse(buf.toString("utf8"));
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** PNG текстуры из jar (или null). */
export function readModTexture(ns: string, path: string): Buffer | null {
  const na = getModIndex().get(ns);
  if (!na) return null;
  const jarPath = na.textures.get(path);
  if (jarPath) {
    const buf = readFromJar(jarPath, `assets/${ns}/textures/${path}.png`);
    if (buf) return buf;
  }
  // Файл вне assets/ (картинки колод charta: decks/standard/blue.png).
  const extraJar = na.extra.get(path);
  if (extraJar) {
    const buf = readFromJar(extraJar, `${path}.png`);
    if (buf) return buf;
  }
  return null;
}

/**
 * Картинка для предмета, который в игре рисуется кастомным рендерером
 * (например charta:deck — модель builtin/entity, плоской текстуры нет).
 * Берём ту картинку, которой мод реально рисует предмет: у колоды это PNG
 * колоды из jar. Возвращает null, если ничего не нашли.
 */
export function readModCustomIcon(ns: string, itemName: string): Buffer | null {
  const na = getModIndex().get(ns);
  if (!na) return null;

  // 1. Обычные текстуры с тем же именем (item/<name>.png, block/<name>.png).
  for (const candidate of [`item/${itemName}`, `block/${itemName}`]) {
    if (na.textures.has(candidate)) {
      const buf = readModTexture(ns, candidate);
      if (buf) return buf;
    }
  }

  // 2. Картинки вне assets/ — колода и её обложка (для deck).
  const candidates: string[] = [];
  const groupOrder = ["standard", "light", "dark", "fun"];
  for (const group of groupOrder) {
    for (const color of ["blue", "red", "green", "aqua"]) {
      candidates.push(`decks/${group}/${color}`);
    }
  }
  for (const candidate of candidates) {
    if (!na.extra.has(candidate)) continue;
    const buf = readModTexture(ns, candidate);
    if (buf) return buf;
  }
  return null;
}

/**
 * Есть ли картинка, которой мод рисует предмет сам (кастомный рендерер).
 * Дешевле, чем читать байты: проверяем только наличие файлов.
 */
export function hasModCustomIcon(ns: string, itemName: string): boolean {
  const na = getModIndex().get(ns);
  if (!na) return false;
  if (na.textures.has(`item/${itemName}`) || na.textures.has(`block/${itemName}`)) return true;
  for (const group of ["standard", "light", "dark", "fun"]) {
    for (const color of ["blue", "red", "green", "aqua"]) {
      if (na.extra.has(`decks/${group}/${color}`)) return true;
    }
  }
  return false;
}

/** JSON из data/<ns>/<path>.json (описания предметов/колод мода), либо null. */
export function readModData(ns: string, path: string): Record<string, unknown> | null {
  const na = getModIndex().get(ns);
  if (!na) return null;
  const jarPath = na.dataFiles.get(path);
  if (!jarPath) return null;
  const buf = readFromJar(jarPath, `data/${ns}/${path}.json`);
  if (!buf) return null;
  try {
    const parsed = JSON.parse(buf.toString("utf8"));
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Переводы мода (en_us.json) — по ним предмет различается по названию:
 * например, «Russia Deck» у charta:deck. Возвращает null, если языка нет.
 */
export function readModLang(ns: string, lang = "en_us"): Record<string, string> | null {
  const na = getModIndex().get(ns);
  if (!na) return null;
  const entry = `assets/${ns}/lang/${lang}.json`;
  const jarPath = na.langFiles.get(entry) ?? [...na.langFiles.entries()].find(([k]) => k.endsWith(`/${lang}.json`))?.[1];
  if (!jarPath) return null;
  const key = na.langFiles.has(entry) ? entry : [...na.langFiles.keys()].find((k) => k.endsWith(`/${lang}.json`))!;
  const buf = readFromJar(jarPath, key);
  if (!buf) return null;
  try {
    const parsed = JSON.parse(buf.toString("utf8")) as Record<string, string>;
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) if (typeof v === "string") clean[k] = v;
    return clean;
  } catch {
    return null;
  }
}

/** Диагностика: список namespace, найденных в модах. */
export function listModNamespaces(): string[] {
  return [...getModIndex().keys()].sort();
}

/** Диагностика: сколько ассетов у namespace. */
export function describeNamespace(ns: string): {
  models: number;
  textures: number;
  extra: number;
  data: number;
  lang: number;
} | null {
  const na = getModIndex().get(ns);
  if (!na) return null;
  return {
    models: na.models.size,
    textures: na.textures.size,
    extra: na.extra.size,
    data: na.dataFiles.size,
    lang: na.langFiles.size,
  };
}

/** Список путей внутри data/<ns>/ (для перебора описаний пред��етов). */
export function listModData(ns: string, prefix = ""): string[] {
  const na = getModIndex().get(ns);
  if (!na) return [];
  if (!prefix) return [...na.dataFiles.keys()].sort();
  return [...na.dataFiles.keys()].filter((k) => k.startsWith(prefix)).sort();
}

/** Есть ли картинка вне assets/ по пути вида "decks/flags/russia". */
export function hasModExtra(ns: string, path: string): boolean {
  const na = getModIndex().get(ns);
  return !!na?.extra.has(path);
}