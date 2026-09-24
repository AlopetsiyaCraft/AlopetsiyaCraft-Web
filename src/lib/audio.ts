import { join, resolve, sep } from "path";

/** Максимальный размер mp3, байт (15 МБ). */
export const MAX_AUDIO_BYTES = 15 * 1024 * 1024;

/** Разрешённое расширение файла. */
export const AUDIO_EXT = ".mp3";

/**
 * Корень загруженных аудио. Хранится в data/ (вне git), отдаётся
 * динамическим роутом /api/audio/[id]/file. Файлы лежат по путям
 * data/audio/<userId>/<uuid>.mp3 — id пользователя берётся из БД,
 * имя файла генерируем мы сами (uuid.mp3), поэтому путь на диске
 * всегда собирается заново из двух этих величин и не доверяет
 * никакому пользовательскому вводу.
 */
export function audioRoot(...parts: string[]): string {
  return join(process.cwd(), "data", "audio", ...parts);
}

/** Путь к файлу трека на диске. */
export function trackFilePath(userId: number, fileName: string): string {
  return audioRoot(String(userId), fileName);
}

/**
 * Резолвит путь внутри корня аудио в абсолютный путь на диске
 * (защита от path traversal при раздаче файлов).
 */
export function resolveAudioPath(...parts: string[]): string | null {
  const root = resolve(audioRoot());
  const target = resolve(root, ...parts);
  if (target === root || target.startsWith(root + sep)) {
    return target;
  }
  return null;
}

/** Внутренний URL сайта (для мода / SVC-сервера на той же машине). */
export function getSiteBaseUrl(): string {
  const raw = process.env.WEBSITE_URL || "http://127.0.0.1:3000";
  return raw.startsWith("http://") || raw.startsWith("https://") ? raw : `http://${raw}`;
}

/** Стабильный URL файла трека — с него SVC-сервер тянет аудио. */
export function trackFileUrl(trackId: number): string {
  return `${getSiteBaseUrl()}/api/audio/${trackId}/file`;
}

/** Максимальный размер обложки, байт (5 МБ). */
export const MAX_COVER_BYTES = 5 * 1024 * 1024;

/** Расширение файла обложки. */
export const COVER_EXT = ".png";

/** Путь к файлу обложки на диске (в том же корне audio/<userId>/). */
export function coverFilePath(userId: number, fileName: string): string {
  return audioRoot(String(userId), fileName);
}

/** Публичный URL обложки трека (используется UI и клиентским превью). */
export function coverFileUrl(trackId: number): string {
  return `${getSiteBaseUrl()}/api/audio/${trackId}/cover`;
}

/**
 * Производные файлы обложки (генерируются на сервере через sharp)
 * называются детерминированно от имени оригинала, поэтому никаких
 * новых колонок в БД не нужно:
 *  - <uuid>.png        — обычная обложка (фото качества, для сайта)
 *  - <uuid>-pixel.png  — 16×16 для ресурспака пластинок
 *  - <uuid>-thumb.png  — миниатюра 128×128 для списков и стены
 */

/** Имя файла пиксельной обложки (16×16) для ресурспака пластинок. */
export function pixelCoverFileName(coverFileName: string): string {
  return coverFileName.replace(/\.[^.]+$/, "") + "-pixel.png";
}

/** Имя файла миниатюры обложки (128×128) для списков/стены. */
export function thumbCoverFileName(coverFileName: string): string {
  return coverFileName.replace(/\.[^.]+$/, "") + "-thumb.png";
}

/** Путь к пиксельной обложке на диске. */
export function coverPixelFilePath(userId: number, coverFileName: string): string {
  return audioRoot(String(userId), pixelCoverFileName(coverFileName));
}

/** Путь к миниатюре обложки на диске. */
export function coverThumbFilePath(userId: number, coverFileName: string): string {
  return audioRoot(String(userId), thumbCoverFileName(coverFileName));
}

/** Публичный URL миниатюры обложки (для списков и стены). */
export function coverThumbFileUrl(trackId: number): string {
  return `/api/audio/${trackId}/cover/thumb`;
}