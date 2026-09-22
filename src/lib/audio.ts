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