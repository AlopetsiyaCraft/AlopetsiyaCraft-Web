"use client";

import { useEffect, useRef } from "react";

interface HeadViewerProps {
  skinUrl: string;
  size?: number;
}

export default function HeadViewer({ skinUrl, size = 32 }: HeadViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, size, size);

      ctx.drawImage(
        img,
        8, 8, 8, 8,
        0, 0, size, size
      );

      if (img.width >= 64) {
        ctx.drawImage(
          img,
          40, 8, 8, 8,
          0, 0, size, size
        );
      }
    };

    img.src = skinUrl;
  }, [skinUrl, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="rounded"
      style={{ imageRendering: "pixelated" }}
    />
  );
}
