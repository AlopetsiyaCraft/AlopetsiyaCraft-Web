"use client";

import { useEffect, useRef, useState } from "react";
import { SkinViewer as SkinViewerLib, WalkingAnimation } from "skinview3d";
import { CanvasTexture, RepeatWrapping } from "three";

interface SkinViewerProps {
  skinUrl: string;
  capeUrl?: string | null;
  /** Модель персонажа: "default" (Стив, широкая) или "slim" (Алекс). Без значения — auto-detect. */
  model?: "default" | "slim";
  width?: number;
  height?: number;
  showControls?: boolean;
  resetKey?: number;
}

function getCheckerColors(): [string, string] {
  const style = getComputedStyle(document.documentElement);
  return [
    style.getPropertyValue("--checker-a").trim() || "#2a2a2a",
    style.getPropertyValue("--checker-b").trim() || "#1a1a1a",
  ];
}

function createCheckerTexture(w: number, h: number): CanvasTexture {
  const [a, b] = getCheckerColors();
  const s = 24;
  const c = document.createElement("canvas");
  c.width = s * 2;
  c.height = s * 2;
  const x = c.getContext("2d")!;
  x.fillStyle = a;
  x.fillRect(0, 0, s * 2, s * 2);
  x.fillStyle = b;
  x.fillRect(0, 0, s, s);
  x.fillRect(s, s, s, s);
  const tex = new CanvasTexture(c);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.repeat.set(Math.ceil(w / (s * 2)), Math.ceil(h / (s * 2)));
  return tex;
}

export default function SkinViewer({
  skinUrl,
  capeUrl,
  model,
  width = 300,
  height = 300,
  showControls = true,
  resetKey = 0,
}: SkinViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<SkinViewerLib | null>(null);
  const cameraStateRef = useRef<{ position: { x: number; y: number; z: number }; target: { x: number; y: number; z: number } } | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    cameraStateRef.current = null;
  }, [resetKey]);

  useEffect(() => {
    if (!canvasRef.current) return;

    const viewer = new SkinViewerLib({
      canvas: canvasRef.current,
      width,
      height,
    });

    if (cameraStateRef.current) {
      const { position, target } = cameraStateRef.current;
      viewer.camera.position.set(position.x, position.y, position.z);
      viewer.controls.target.set(target.x, target.y, target.z);
    } else {
      viewer.camera.position.set(0, 3, 48);
    }
    viewer.controls.enableRotate = true;
    viewer.controls.enableZoom = false;
    viewer.controls.enablePan = false;

    viewer.loadSkin(skinUrl, model ? { model } : undefined);

    if (capeUrl) {
      viewer.loadCape(capeUrl);
    } else {
      viewer.loadCape(null);
    }

    viewer.scene.background = createCheckerTexture(width, height);

    const observer = new MutationObserver(() => {
      viewer.scene.background = createCheckerTexture(width, height);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    viewerRef.current = viewer;

    return () => {
      cameraStateRef.current = {
        position: { x: viewer.camera.position.x, y: viewer.camera.position.y, z: viewer.camera.position.z },
        target: { x: viewer.controls.target.x, y: viewer.controls.target.y, z: viewer.controls.target.z },
      };
      observer.disconnect();
      viewer.dispose();
    };
  }, [skinUrl, capeUrl, model, width, height, resetKey]);

  function toggleAnimation() {
    const viewer = viewerRef.current;
    if (!viewer) return;

    if (isAnimating) {
      viewer.animation = null;
      setIsAnimating(false);
    } else {
      viewer.animation = new WalkingAnimation();
      setIsAnimating(true);
    }
  }

  return (
    <div style={{ width, height, position: "relative" }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ display: "block", width, height }}
      />
      {showControls && (
        <button
          onClick={toggleAnimation}
          className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded bg-black/50 hover:bg-black/70 text-white transition-colors"
          title={isAnimating ? "Остановить" : "Воспроизвести анимацию"}
        >
          {isAnimating ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}
