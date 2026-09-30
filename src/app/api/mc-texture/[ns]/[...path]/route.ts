/**
 * Отдача текстур модов прямо из .jar.
 *
 * GET /api/mc-texture/<namespace>/<path>.png   — текстура assets/<ns>/textures/<path>.png
 * GET /api/mc-texture/<namespace>/_icon/<item>.png — картинка, которой мод рисует
 *                                                   предмет сам (кастомный рендерер)
 *
 * Файлы неизменяемы, пока не пересобран мод, поэтому кэшируем надолго и отдаём
 * ETag по jar. Путь и namespace проверяются, чтобы через роут нельзя было
 * выбрать произвольный файл.
 */

import { readModCustomIcon, readModTexture } from "@/lib/mcMods";

/** Слишком длинный путь — точно не текстура. */
const MAX_PATH_LENGTH = 200;

function isValidNamespace(ns: string): boolean {
  return /^[a-z0-9_.-]{1,64}$/.test(ns);
}

/** Убирает опасные сегменты и .png, возвращает путь внутри jar или null. */
function sanitizeTexturePath(segments: string[]): string | null {
  if (segments.length === 0) return null;
  const parts: string[] = [];
  for (const raw of segments) {
    const seg = decodeURIComponent(raw);
    if (!seg || seg === "." || seg === "..") return null;
    if (seg.includes("/") || seg.includes("\\") || seg.includes("\0")) return null;
    parts.push(seg.replace(/\.png$/i, ""));
    if (parts[parts.length - 1] === "") return null;
  }
  const joined = parts.join("/");
  if (!joined || joined.length > MAX_PATH_LENGTH) return null;
  return joined;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ns: string; path: string[] }> }
) {
  const { ns, path } = await params;

  if (!isValidNamespace(ns)) {
    return new Response("Bad namespace", { status: 400 });
  }
  if (!Array.isArray(path) || path.length === 0) {
    return new Response("Bad path", { status: 400 });
  }

  let bytes: Buffer | null = null;
  let etagSource: string;

  // /_icon/<item> — предмет с кастомным рендерером (charta:deck и т.п.)
  if (path[0] === "_icon") {
    const item = sanitizeTexturePath(path.slice(1));
    if (!item) return new Response("Bad item", { status: 400 });
    bytes = readModCustomIcon(ns, item);
    etagSource = `icon:${ns}:${item}`;
  } else {
    const texturePath = sanitizeTexturePath(path);
    if (!texturePath) return new Response("Bad path", { status: 400 });
    bytes = readModTexture(ns, texturePath);
    etagSource = `${ns}:${texturePath}`;
  }

  if (!bytes || bytes.length === 0) {
    return new Response("Not found", { status: 404 });
  }

  const headers: Record<string, string> = {
    "Content-Type": "image/png",
    "Content-Length": String(bytes.length),
    "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    ETag: `W/"${etagSource}:${bytes.length}"`,
  };

  // Если пришёл If-None-Match — не отдаём тело повторно.
  const ifNoneMatch = _request.headers.get("if-none-match");
  if (ifNoneMatch && ifNoneMatch === headers.ETag) {
    return new Response(null, { status: 304, headers });
  }

  return new Response(new Uint8Array(bytes), { status: 200, headers });
}