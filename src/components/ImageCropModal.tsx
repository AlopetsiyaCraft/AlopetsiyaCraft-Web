"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { squareCropBlob, type CropRect } from "@/lib/discpixel";

export interface PickedCover {
  blob: Blob;
  preview: string;
}

/** Размер квадратного вьюпорта на экране (px). Рамка кадрирования = весь вьюпорт. */
const VIEW = 320;
const MIN_ZOOM = 1;
const MAX_ZOOM = 10;

/**
 * Модалка кадрирования фото в квадрате 1:1 (как в инстаграме):
 * картинка больше квадрата, её двигают мышью и зумируют колесом/+−.
 * Квадратный вьюпорт и есть рамка кадрирования.
 */
export default function ImageCropModal({
  file,
  onConfirm,
  onCancel,
}: {
  file: File;
  onConfirm: (cover: PickedCover) => void;
  onCancel: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const zoomRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef<{
    pointer: number;
    startX: number;
    startY: number;
    ox: number;
    oy: number;
  } | null>(null);
  const [zoomLabel, setZoomLabel] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Масштаб: картинка всегда покрывает весь квадрат (cover-fit * zoom)
    const scale = Math.max(VIEW / img.width, VIEW / img.height) * zoomRef.current;
    const halfW = (img.width * scale) / 2;
    const halfH = (img.height * scale) / 2;
    const maxX = Math.max(0, halfW - VIEW / 2);
    const maxY = Math.max(0, halfH - VIEW / 2);
    const o = offsetRef.current;
    const ox = Math.min(maxX, Math.max(-maxX, o.x));
    const oy = Math.min(maxY, Math.max(-maxY, o.y));
    o.x = ox;
    o.y = oy;

    ctx.clearRect(0, 0, VIEW, VIEW);
    ctx.imageSmoothingEnabled = true;
    // Центр картинки рисуется в точке (VIEW/2 + ox, VIEW/2 + oy)
    ctx.drawImage(
      img,
      VIEW / 2 + ox - halfW,
      VIEW / 2 + oy - halfH,
      img.width * scale,
      img.height * scale
    );

    // Рамка 1:1 (вьюпорт) + сетка третей
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 2;
    ctx.strokeRect(0.5, 0.5, VIEW - 1, VIEW - 1);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.moveTo(VIEW / 3, 0);
    ctx.lineTo(VIEW / 3, VIEW);
    ctx.moveTo((2 * VIEW) / 3, 0);
    ctx.lineTo((2 * VIEW) / 3, VIEW);
    ctx.moveTo(0, VIEW / 3);
    ctx.lineTo(VIEW, VIEW / 3);
    ctx.moveTo(0, (2 * VIEW) / 3);
    ctx.lineTo(VIEW, (2 * VIEW) / 3);
    ctx.stroke();
  }, []);

  // Загрузка файла картинки (через FileReader/data-URL — без гонок с revokeObjectURL)
  useEffect(() => {
    if (file.type && !file.type.startsWith("image/")) {
      setError("Это не картинка");
      return;
    }
    let cancelled = false;
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      if (cancelled) return;
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        imgRef.current = img;
        offsetRef.current = { x: 0, y: 0 };
        zoomRef.current = 1;
        setZoomLabel(1);
        draw();
      };
      img.onerror = () => {
        if (!cancelled) setError("Не удалось прочитать изображение");
      };
      img.src = reader.result as string;
    };
    reader.onerror = () => {
      if (!cancelled) setError("Не удалось прочитать изображение");
    };
    reader.readAsDataURL(file);
    return () => {
      cancelled = true;
    };
  }, [file, draw]);

  // Колесо мыши: не-passive, чтобы можно было preventDefault
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomRef.current = Math.min(
        MAX_ZOOM,
        Math.max(MIN_ZOOM, zoomRef.current * Math.exp(-e.deltaY * 0.002))
      );
      setZoomLabel(zoomRef.current);
      draw();
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [draw]);

  function changeZoom(factor: number) {
    zoomRef.current = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoomRef.current * factor));
    setZoomLabel(zoomRef.current);
    draw();
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    canvasRef.current?.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointer: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      ox: offsetRef.current.x,
      oy: offsetRef.current.y,
    };
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointer !== e.pointerId) return;
    offsetRef.current.x = drag.ox + (e.clientX - drag.startX);
    offsetRef.current.y = drag.oy + (e.clientY - drag.startY);
    draw();
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (dragRef.current?.pointer === e.pointerId) dragRef.current = null;
  }

  function currentCropRect(img: HTMLImageElement): CropRect {
    const scale = Math.max(VIEW / img.width, VIEW / img.height) * zoomRef.current;
    const ox = offsetRef.current.x;
    const oy = offsetRef.current.y;
    const size = VIEW / scale;
    const cx = img.width / 2 - (VIEW / 2 + ox) / scale;
    const cy = img.height / 2 - (VIEW / 2 + oy) / scale;
    const x = Math.max(0, Math.min(img.width - size, cx));
    const y = Math.max(0, Math.min(img.height - size, cy));
    return { x, y, size };
  }

  async function apply() {
    const img = imgRef.current;
    if (!img || busy) return;
    setBusy(true);
    setError(null);
    try {
      const rect = currentCropRect(img);
      const blob = await squareCropBlob(img, rect);
      onConfirm({ blob, preview: URL.createObjectURL(blob) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось обработать фото");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onCancel}>
      <div
        className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 flex flex-col gap-3 w-full max-w-[400px]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-bold">Кадрируй обложку (1:1)</h2>
        <p className="text-xs text-[var(--text-muted)]">
          Перетаскивай фото мышью, зум — колесо или кнопки «+»/«−». Квадрат — рамка кадрирования.
        </p>

        <div className="self-center">
          <canvas
            ref={canvasRef}
            width={VIEW}
            height={VIEW}
            className="rounded-lg border-2 border-white/20 cursor-grab active:cursor-grabbing touch-none select-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
        </div>

        <div className="flex items-center justify-center gap-3 text-sm">
          <button
            type="button"
            onClick={() => changeZoom(1 / 1.25)}
            className="w-8 h-8 rounded-lg bg-[var(--hover)] hover:bg-[var(--border)] transition-colors"
            title="Уменьшить"
          >
            −
          </button>
          <span className="text-[var(--text-muted)] w-12 text-center">×{zoomLabel.toFixed(1)}</span>
          <button
            type="button"
            onClick={() => changeZoom(1.25)}
            className="w-8 h-8 rounded-lg bg-[var(--hover)] hover:bg-[var(--border)] transition-colors"
            title="Увеличить"
          >
            +
          </button>
        </div>

        {error && <span className="text-xs text-red-400">{error}</span>}

        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-3 py-1.5 rounded-lg text-sm text-[var(--text-muted)] hover:bg-[var(--hover)] transition-colors"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={busy || error !== null}
            className="px-4 py-1.5 rounded-lg bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {busy ? "Готовим…" : "Применить"}
          </button>
        </div>
      </div>
    </div>
  );
}