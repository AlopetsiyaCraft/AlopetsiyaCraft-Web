/**
 * Иконка предмета ровно такая, как в инвентаре игры.
 *
 * GET /api/mc-icon/<namespace>/<item path>[?name=<название стека>]
 *
 * Иконка рисуется на сервере: плоские предметы — квад со слоями layer0, layer1,
 * блоки — геометрия модели в изометрии по display.gui. Источники ассетов те же,
 * что и у игры: .jar модов с диска и зеркало ванильных ассетов.
 *
 * Параметр name нужен для предметов, которые различаются только названием стека
 * (например, колоды charta:deck — «Russia Deck»). Рендер кэшируется в data/icons,
 * так что ответ неизменяем, пока не пересобраны моды.
 */

import { renderItemIcon } from "@/lib/mcIcon";

/** Слишком длинный путь — точно не предмет. */
const MAX_PATH_LENGTH = 200;

function isValidNamespace(ns: string): boolean {
  return /^[a-z0-9_.-]{1,64}$/.test(ns);
}

/** Возвращает путь модели предмета (<item>/<name>) или null. */
function sanitizeItemPath(segments: string[]): string | null {
  if (segments.length === 0) return null;
  const parts: string[] = [];
  for (const raw of segments) {
    const seg = decodeURIComponent(raw);
    if (!seg || seg === "." || seg === "..") return null;
    if (seg.includes("\\") || seg.includes("\0")) return null;
    parts.push(seg);
  }
  const joined = parts.join("/");
  if (!joined || joined.length > MAX_PATH_LENGTH) return null;
  // Имя предмета в моде — только строчные буквы, цифры, _ и /.
  if (!/^[a-z0-9_./-]+$/.test(joined)) return null;
  return joined;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ns: string; path: string[] }> }
) {
  const { ns, path } = await params;

  if (!isValidNamespace(ns)) {
    return new Response("Bad namespace", { status: 400 });
  }
  const itemPath = sanitizeItemPath(Array.isArray(path) ? path : []);
  if (!itemPath) {
    return new Response("Bad item", { status: 400 });
  }

  // У колод и подобных вариантов предметов различие только в названии стека.
  const url = new URL(request.url);
  const stackName = url.searchParams.get("name");

  let bytes: Buffer | null = null;
  try {
    bytes = await renderItemIcon(`${ns}:${itemPath}`, { name: stackName ?? undefined });
  } catch {
    return new Response("Render failed", { status: 500 });
  }

  if (!bytes || bytes.length === 0) {
    // Отдаём пустую картинку, чтобы в интерфейсе не было битой иконки:
    // компонент InventoryGrid нарисует заглушку по onError.
    return new Response(null, { status: 404 });
  }

  const headers: Record<string, string> = {
    "Content-Type": "image/png",
    "Content-Length": String(bytes.length),
    "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    ETag: `W/"icon:${ns}:${itemPath}:${stackName ?? ""}:${bytes.length}"`,
  };

  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch && ifNoneMatch === headers.ETag) {
    return new Response(null, { status: 304, headers });
  }

  return new Response(new Uint8Array(bytes), { status: 200, headers });
}
