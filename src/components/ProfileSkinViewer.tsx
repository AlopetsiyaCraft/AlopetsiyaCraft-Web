"use client";

import dynamic from "next/dynamic";

const SkinViewer = dynamic(() => import("@/components/SkinViewer"), {
  ssr: false,
  loading: () => (
    <div className="w-[300px] h-[300px] bg-[var(--bg)] border border-[var(--border)] rounded-lg flex items-center justify-center">
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
    <div className="rounded-lg border-2 border-[var(--border)] overflow-hidden">
      <SkinViewer skinUrl={skinUrl} capeUrl={capeUrl} model={model} width={300} height={300} showControls={true} />
    </div>
  );
}
