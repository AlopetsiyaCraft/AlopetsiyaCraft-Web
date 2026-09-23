"use client";

/**
 * Пикселизация обложки в стиле Minecraft (на стороне сайта, canvas в браузере).
 *
 * Пользователь сам кадрирует фото в квадрате 1:1, а сюда приходит уже
 * прямоугольник кадрирования (в координатах исходной картинки). Область
 * уменьшается в 16×16 со сглаживанием (усреднённый цвет клетки), затем
 * пережимается без сглаживания — получаются ровные «майнкрафт-пиксели».
 * На выходе: PNG-блоб 16×16 (его отправляем на сервер) и увеличенное превью.
 */

const SIZE = 16;
const PREVIEW_SCALE = 8;

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

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Не удалось прочитать изображение"));
    };
    img.src = url;
  });
}

/** Увеличенное превью с чёткими пикселями. */
function pixelPreview(src: HTMLCanvasElement, scale = PREVIEW_SCALE): string {
  const c = document.createElement("canvas");
  c.width = src.width * scale;
  c.height = src.height * scale;
  const ctx = c.getContext("2d");
  if (!ctx) return src.toDataURL("image/png");
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL("image/png");
}

/**
 * Берёт квадратную область исходного фото (результат кадрирования 1:1)
 * и делает из неё пиксельную обложку 16×16: сглаживание при усадке,
 * затем точная перерисовка без сглаживания → PNG.
 */
export async function pixelateRect(
  img: HTMLImageElement,
  rect: CropRect
): Promise<{ blob: Blob; preview: string }> {
  const down = document.createElement("canvas");
  down.width = SIZE;
  down.height = SIZE;
  const ctx = down.getContext("2d");
  if (!ctx) throw new Error("Canvas недоступен");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.clearRect(0, 0, SIZE, SIZE);
  ctx.drawImage(img, rect.x, rect.y, rect.size, rect.size, 0, 0, SIZE, SIZE);

  const out = document.createElement("canvas");
  out.width = SIZE;
  out.height = SIZE;
  const octx = out.getContext("2d");
  if (!octx) throw new Error("Canvas недоступен");
  octx.imageSmoothingEnabled = false;
  octx.clearRect(0, 0, SIZE, SIZE);
  octx.drawImage(down, 0, 0, SIZE, SIZE);

  const blob = await new Promise<Blob | null>((r) => out.toBlob(r, "image/png"));
  if (!blob) throw new Error("Не удалось создать PNG");

  return { blob, preview: pixelPreview(out) };
}

/** Загрузка файла картинки и получение пиксельной обложки по центру (cover-fit). */
export async function pixelateImage(file: File): Promise<{ blob: Blob; preview: string }> {
  const img = await loadImage(file);
  return pixelateRect(img, defaultCropRect(img));
}