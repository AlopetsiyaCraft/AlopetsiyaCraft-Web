"use client";

/**
 * Экспорт квадратной обложки (на стороне сайта, canvas в браузере).
 *
 * Пользователь сам кадрирует фото в квадрате 1:1, а сюда приходит уже
 * прямоугольник кадрирования (в координатах исходной картинки). Область
 * пережимается в квадрат 512×512 со сглаживанием — получается обычная
 * фотка-обложка нормального качества. Её отправляем на сервер, а сервер
 * уже сам делает из неё: миниатюру 128×128 для списков/стены и
 * пиксельную 16×16 для ресурспака пластинок (sharp).
 */

const EXPORT_SIZE = 512;

/** Прямоугольник кадрирования в пикселях исходной картинки (всегда квадрат). */
export interface CropRect {
  x: number;
  y: number;
  size: number;
}

/** Рамка «по умолчанию»: центральный квадрат 1:1 (cover-fit). */
export function defaultCropRect(img: HTMLImageElement): CropRect {
  const size = Math.min(img.width, img.height);
  return { x: (img.width - size) / 2, y: (img.height - size) / 2, size };
}

/** Квадратный кадр в виде PNG-блоб нормального качества. */
export async function squareCropBlob(
  img: HTMLImageElement,
  rect: CropRect,
  size = EXPORT_SIZE
): Promise<Blob> {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Canvas недоступен");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, rect.x, rect.y, rect.size, rect.size, 0, 0, size, size);
  const blob = await new Promise<Blob | null>((resolve) => c.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Не удалось создать PNG обложки");
  return blob;
}