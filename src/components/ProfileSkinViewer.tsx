"use client";

import dynamic from "next/dynamic";

const SkinViewer = dynamic(() => import("@/components/SkinViewer"), {
  ssr: false,
  loading: () => (
    <div className="w-[300px] h-[300px] bg-[var(--bg)] border-2 border-black flex items-center justify-center">
      <span className="text-[var(--text-muted)] text-xs">Загрузка...</span>
    </div>
  ),
});

export default function ProfileSkinViewer({
  skinUrl,
  capeUrl,
  model,
}: {
  skinUrl: string;
  capeUrl?: string | null;
  model?: "default" | "slim";
}) {
  return (
    <div className="border-2 border-black overflow-hidden">
      <SkinViewer skinUrl={skinUrl} capeUrl={capeUrl} model={model} width={300} height={300} showControls={true} />
    </div>
  );
}
