"use client";

import { useEffect, useState } from "react";

function getCapeStyle(capeUrl: string, width: number, height: number) {
  return new Promise<{ bgSize: string; bgPos: string }>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const tw = img.naturalWidth;
      const th = img.naturalHeight;
      let bgSize: string;
      let bgPos: string;

      if (tw === 64 && th === 32) {
        const sx = width / 10;
        const sy = height / 16;
        bgSize = `${tw * sx}px ${th * sy}px`;
        bgPos = `${-1 * sx}px ${-1 * sy}px`;
      } else if (tw === 22 && th === 17) {
        const sx = width / 11;
        const sy = height / 16;
        bgSize = `${tw * sx}px ${th * sy}px`;
        bgPos = `0px 0px`;
      } else if (tw === 46 && th === 22) {
        const sx = width / 10;
        const sy = height / 16;
        bgSize = `${tw * sx}px ${th * sy}px`;
        bgPos = `${-23 * sx}px 0px`;
      } else {
        bgSize = "contain";
        bgPos = "center";
      }
      resolve({ bgSize, bgPos });
    };
    img.onerror = () => {
      resolve({ bgSize: "contain", bgPos: "center" });
    };
    img.src = capeUrl;
  });
}

export default function CapeThumbnail({
  capeUrl,
  width = 30,
  height = 48,
}: {
  capeUrl: string;
  width?: number;
  height?: number;
}) {
  const [style, setStyle] = useState<{ bgSize: string; bgPos: string } | null>(null);

  useEffect(() => {
    if (!capeUrl) return;
    let cancelled = false;
    getCapeStyle(capeUrl, width, height).then((s) => {
      if (!cancelled) setStyle(s);
    });
    return () => {
      cancelled = true;
    };
  }, [capeUrl, width, height]);

  return (
    <div
      style={{
        width,
        height,
        backgroundImage: `url(${capeUrl})`,
        backgroundSize: style?.bgSize ?? `${64 * 3}px ${32 * 3}px`,
        backgroundPosition: style?.bgPos ?? `${-1 * 3}px ${-1 * 3}px`,
        backgroundRepeat: "no-repeat",
        imageRendering: "pixelated",
      }}
    />
  );
}
