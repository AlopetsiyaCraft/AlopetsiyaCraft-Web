"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const VIEW_W = 480;
const VIEW_H = 150;
const OUTPUT_W = 1600;
const OUTPUT_H = 500;
const MIN_ZOOM = 1;
const MAX_ZOOM = 10;

/**
 * Кадрирование фона профиля под баннер 16:5. Канвас — видимая рамка:
 * картинку двигают мышью/пальцем, зумят колесом или кнопками.
 * На выходе — готовый WebP 1600×500, сервер только пересохранит его.
 */
export default function ProfileBannerCropModal({
  file,
  onConfirm,
  onCancel,
}: {
  file: File;
  onConfirm: (blob: Blob) => void;
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

    const scale = Math.max(VIEW_W / img.width, VIEW_H / img.height) * zoomRef.current;
    const halfW = (img.width * scale) / 2;
    const halfH = (img.height * scale) / 2;
    const maxX = Math.max(0, halfW - VIEW_W / 2);
    const maxY = Math.max(0, halfH - VIEW_H / 2);

    const o = offsetRef.current;
    o.x = Math.min(maxX, Math.max(-maxX, o.x));
    o.y = Math.min(maxY, Math.max(-maxY, o.y));

    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      img,
      VIEW_W / 2 + o.x - halfW,
      VIEW_H / 2 + o.y - halfH,
      img.width * scale,
      img.height * scale
    );

    // Рамка баннера + сетка третей
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 2;
    ctx.strokeRect(0.5, 0.5, VIEW_W - 1, VIEW_H - 1);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.beginPath();
    ctx.moveTo(VIEW_W / 3, 0);
    ctx.lineTo(VIEW_W / 3, VIEW_H);
    ctx.moveTo((2 * VIEW_W) / 3, 0);
    ctx.lineTo((2 * VIEW_W) / 3, VIEW_H);
    ctx.moveTo(0, VIEW_H / 3);
    ctx.lineTo(VIEW_W, VIEW_H / 3);
    ctx.moveTo(0, (2 * VIEW_H) / 3);
    ctx.lineTo(VIEW_W, (2 * VIEW_H) / 3);
    ctx.stroke();
  }, []);

  useEffect(() => {
    let cancelled = false;
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
    const canvas = canvasRef.current;
    if (!drag || drag.pointer !== e.pointerId || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const kx = VIEW_W / rect.width;
    const ky = VIEW_H / rect.height;
    offsetRef.current.x = drag.ox + (e.clientX - drag.startX) * kx;
    offsetRef.current.y = drag.oy + (e.clientY - drag.startY) * ky;
    draw();
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (dragRef.current?.pointer === e.pointerId) dragRef.current = null;
  }

  async function apply() {
    const img = imgRef.current;
    if (!img || busy) return;
    setBusy(true);
    setError(null);
    try {
      const scale = Math.max(VIEW_W / img.width, VIEW_H / img.height) * zoomRef.current;
      const sw = VIEW_W / scale;
      const sh = VIEW_H / scale;
      const cx = img.width / 2 - (VIEW_W / 2 + offsetRef.current.x) / scale;
      const cy = img.height / 2 - (VIEW_H / 2 + offsetRef.current.y) / scale;
      const sx = Math.max(0, Math.min(img.width - sw, cx));
      const sy = Math.max(0, Math.min(img.height - sh, cy));

      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_W;
      canvas.height = OUTPUT_H;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas недоступен");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, OUTPUT_W, OUTPUT_H);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/webp", 0.86)
      );
      if (!blob) throw new Error("Не удалось создать картинку");
      onConfirm(blob);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось обработать фон");
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4"
      onClick={onCancel}
    >
      <div
        className="mc-panel flex w-full max-w-[600px] flex-col gap-3 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-bold">Кадрируй фон профиля (16:5)</h2>
        <p className="text-xs text-[var(--text-muted)]">
          Перетаскивай картинку мышью или пальцем, зум — колесо или кнопки «+»/«−».
          Рамка показывает, что попадёт в баннер.
        </p>

        <canvas
          ref={canvasRef}
          width={VIEW_W}
          height={VIEW_H}
          className="w-full cursor-grab touch-none select-none border-2 border-black active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />

        <div className="flex items-center justify-center gap-3 text-sm">
          <button
            type="button"
            onClick={() => changeZoom(1 / 1.25)}
            className="mc-btn h-8 w-8 p-0"
            title="Уменьшить"
          >
            −
          </button>
          <span className="w-12 text-center text-[var(--text-muted)]">
            ×{zoomLabel.toFixed(1)}
          </span>
          <button
            type="button"
            onClick={() => changeZoom(1.25)}
            className="mc-btn h-8 w-8 p-0"
            title="Увеличить"
          >
            +
          </button>
        </div>

        {error && <span className="text-xs text-[var(--mc-red)]">{error}</span>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className="mc-btn text-sm">
            Отмена
          </button>
          <button
            type="button"
            onClick={() => void apply()}
            disabled={busy || error !== null}
            className="mc-btn mc-btn-primary text-sm"
          >
            {busy ? "Готовим…" : "Применить"}
          </button>
        </div>
      </div>
    </div>
  );
}
