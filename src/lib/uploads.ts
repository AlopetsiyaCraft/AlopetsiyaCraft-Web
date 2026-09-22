import { join, resolve, sep } from "path";

/**
 * Корень загруженных файлов. Хранится вне public/ и вне git (data/ уже
 * в .gitignore), а отдаётся динамическим роутом /uploads/[...file],
 * который читает файл с диска на каждый запрос. Поэтому новые файлы
 * работают сразу после загрузки и в dev, и в production — в отличие от
 * статики из public/, которую `next start` обслуживает по снимку на
 * момент старта сервера.
 */
export function uploadsRoot(): string {
  return join(process.cwd(), "data", "uploads");
}

/** Полный путь к поддиректории внутри корня загрузок (создание — на стороне вызывающего). */
export function uploadsDir(...parts: string[]): string {
  return join(uploadsRoot(), ...parts);
}

/**
 * Резолвит URL вида /uploads/... в путь на диске внутри uploadsRoot().
 * Возвращает null, если URL вне допустимой зоны (защита от path traversal).
 */
export function resolveUploadPath(url: string): string | null {
  const prefix = "/uploads/";
  if (!url.startsWith(prefix)) return null;

  const segments = url.slice(prefix.length).split("/");
  if (segments.some((s) => s === "" || s === "." || s === "..")) return null;

  const root = resolve(uploadsRoot());
  const target = resolve(root, ...segments);
  if (target === root || target.startsWith(root + sep)) {
    return target;
  }
  return null;
}