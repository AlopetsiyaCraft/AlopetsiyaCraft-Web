"use client";

import { useEffect, useRef } from "react";
import { SkinViewer as SkinViewerLib } from "skinview3d";

interface SkinPreviewProps {
  skinUrl: string;
  size?: number;
}

export default function SkinPreview({ skinUrl, size = 64 }: SkinPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<SkinViewerLib | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const viewer = new SkinViewerLib({
      canvas: canvasRef.current,
      width: size,
      height: size,
    });

    viewer.camera.position.set(0, 0, 60);
    viewer.controls.enableRotate = false;
    viewer.controls.enableZoom = false;
    viewer.controls.enablePan = false;

    viewer.loadSkin(skinUrl);

    viewerRef.current = viewer;

    return () => {
      viewer.dispose();
    };
  }, [skinUrl, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="rounded"
      style={{ background: "transparent" }}
    />
  );
}
