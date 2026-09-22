import { extname, join } from "path";
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