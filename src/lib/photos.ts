import { extname } from "path";
import { randomUUID } from "crypto";
import { uploadsDir } from "./uploads";

/** Максимальный размер фото, байт (12 МБ). */
export const MAX_PHOTO_BYTES = 12 * 1024 * 1024;

/** Разрешённые расширения (принимаем и то, что отдают камеры/скриншоты). */
export const PHOTO_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

/**
 * Корень фото. Файлы лежат в data/uploads/photos/<generated>.<ext>,
 * а отдаются уже существующим динамическим роутом /uploads/[...file]
 * (он ходит в data/uploads). Имя файла всегда генерируем сами — путь на
 * диске никогда не строится из пользовательского ввода.
 */
export function photoRoot(...parts: string[]): string {
  return uploadsDir("photos", ...parts);
}

/** Проверка, что имя файла выглядит как разрешённый формат фото. */
export function isPhotoExt(name: string): boolean {
  return PHOTO_EXTS.has(extname(name).toLowerCase());
}

/** Генерируем имя файла на диске, сохраняя расширение оригинала. */
export function generatePhotoFileName(originalName: string): string {
  const ext = extname(originalName).toLowerCase() || ".jpg";
  return `${Date.now()}-${randomUUID()}${ext}`;
}

/** Публичный URL фото (отдаётся роутером /uploads). */
export function photoUrl(fileName: string): string {
  return `/uploads/photos/${fileName}`;
}

/**
 * Миниатюры фото, генерируются на сервере (sharp, JPEG) и лежат рядом с
 * оригиналом под детерминированными именами — новых колонок в БД не нужно:
 *  - <base>-thumb.jpg — ≤480px, для квадратиков «Фото» на стене и сеток;
 *  - <base>-post.jpg  — ≤640px и мягче JPEG (quality 90), для вложений
 *                       фото в постах стены (они выводятся крупнее и
 *                       сильнее сжимать нельзя — мылятся).
 */

/** Максимальная сторона миниатюры для сеток/блока «Фото» (px). */
export const PHOTO_THUMB_MAX = 480;

/** Максимальная сторона миниатюры для фото в постах стены (px). */
export const PHOTO_POST_MAX = 640;

/** Качество JPEG миниатюр (выше — меньше сжатие). */
export const PHOTO_JPEG_QUALITY = 82;

/** Качество JPEG миниатюр для постов (чуть мягче сжатие). */
export const PHOTO_POST_JPEG_QUALITY = 90;

/** Имя миниатюры для сеток/блока «Фото». */
export function photoThumbFileName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "") + "-thumb.jpg";
}

/** Имя миниатюры для фото в постах стены. */
export function photoPostFileName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "") + "-post.jpg";
}

/** Публичный URL миниатюры для сеток/блока «Фото». */
export function photoThumbUrl(fileName: string): string {
  return `/uploads/photos/${photoThumbFileName(fileName)}`;
}

/** Публичный URL миниатюры для фото в постах стены. */
export function photoPostUrl(fileName: string): string {
  return `/uploads/photos/${photoPostFileName(fileName)}`;
}