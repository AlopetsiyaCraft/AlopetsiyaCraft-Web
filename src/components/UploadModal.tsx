"use client";

import { useRef, useState, type ChangeEvent } from "react";
import ImageCropModal, { type PickedCover } from "./ImageCropModal";

const MAX_AUDIO_BYTES = 15 * 1024 * 1024;

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} МБ`
    : `${Math.max(1, Math.round(bytes / 1024))} КБ`;
}

/**
 * Всплывающее окно загрузки песни: шаг 1 — файл .mp3, шаг 2 — фото обложки
 * (кадрирование 1:1 в ImageCropModal). Загружает оба файла сразу.
 */
export default function UploadModal({
  onClose,
  onUploaded,
}: {
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [pendingAudio, setPendingAudio] = useState<File | null>(null);
  const [cover, setCover] = useState<PickedCover | null>(null);
  const [cropPhoto, setCropPhoto] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  function pickAudio(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".mp3")) {
      setError("Только файлы .mp3");
      e.target.value = "";
      return;
    }
    if (f.size > MAX_AUDIO_BYTES) {
      setError("Файл больше 15 МБ");
      e.target.value = "";
      return;
    }
    setError(null);
    setPendingAudio(f);
  }

  function clearAudio() {
    setPendingAudio(null);
    if (audioInputRef.current) audioInputRef.current.value = "";
  }

  function pickPhoto(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.type && !f.type.startsWith("image/")) {
      setError("Фото должно быть картинкой");
      e.target.value = "";
      return;
    }
    setError(null);
    setCropPhoto(f);
  }

  function clearCover() {
    setCover(null);
    if (photoInputRef.current) photoInputRef.current.value = "";
  }

  async function handleUpload() {
    if (!pendingAudio) {
      setError("Сначала выбери файл песни (.mp3)");
      return;
    }
    if (!cover) {
      setError("Выбери фото и кадрируй его в квадрате 1:1 — обложка обязательна");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", pendingAudio);
      fd.append("cover", cover.blob, "cover.png");
      const res = await fetch("/api/audio/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error || "Ошибка загрузки");
      }
      setPendingAudio(null);
      setCover(null);
      if (audioInputRef.current) audioInputRef.current.value = "";
      if (photoInputRef.current) photoInputRef.current.value = "";
      onUploaded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
        <div
          className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 flex flex-col gap-3 w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold">Загрузить песню</h2>
            <button
              onClick={onClose}
              disabled={uploading}
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--hover)] transition-colors text-sm"
              title="Закрыть"
            >
              ✕
            </button>
          </div>

          {/* Шаг 1: песня */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[var(--text-muted)]">1. Песня (.mp3)</span>
            <input
              ref={audioInputRef}
              type="file"
              accept=".mp3,audio/mpeg"
              className="text-sm text-[var(--text-secondary)] file:px-3 file:py-1.5 file:rounded-lg file:bg-[#7c3aed] file:hover:bg-[#6d28d9] file:text-white file:text-xs file:font-medium file:border-0 file:cursor-pointer"
              onChange={pickAudio}
            />
            {pendingAudio && (
              <div className="flex items-center gap-2 text-sm min-w-0">
                <span className="truncate text-[var(--text-secondary)]">
                  🎵 {pendingAudio.name} · {formatSize(pendingAudio.size)}
                </span>
                <button
                  onClick={clearAudio}
                  className="px-2 py-0.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-[var(--hover)] transition-colors text-xs shrink-0"
                  title="Убрать файл"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* Шаг 2: фото обложки */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[var(--text-muted)]">2. Фото обложки (любой формат)</span>
            <label className="self-start text-sm text-[var(--text-secondary)] file:px-3 file:py-1.5 file:rounded-lg file:bg-[#7c3aed] file:hover:bg-[#6d28d9] file:text-white file:text-xs file:font-medium file:border-0 file:cursor-pointer">
              {cover ? "Обложка готова ✓" : "Выбрать фото"}
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={pickPhoto}
              />
            </label>
            {cover && (
              <div className="flex items-end gap-2">
                <div
                  className="w-16 h-16 rounded-lg border border-[var(--border)] bg-[var(--hover)] overflow-hidden"
                  title="Превью пиксельной обложки (16×16, увеличено)"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cover.preview}
                    alt="Превью обложки"
                    className="w-full h-full object-cover"
                    style={{ imageRendering: "pixelated" }}
                  />
                </div>
                <button
                  onClick={clearCover}
                  className="px-2 py-1 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-[var(--hover)] transition-colors text-xs"
                  title="Убрать обложку"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {error && <span className="text-sm text-red-400">{error}</span>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={onClose}
              disabled={uploading}
              className="px-3 py-1.5 rounded-lg text-sm text-[var(--text-muted)] hover:bg-[var(--hover)] transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={handleUpload}
              disabled={!pendingAudio || !cover || uploading}
              className="px-4 py-1.5 rounded-lg bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? "Загружаем…" : "Загрузить"}
            </button>
          </div>
        </div>
      </div>

      {cropPhoto && (
        <ImageCropModal
          file={cropPhoto}
          onConfirm={(c) => {
            setCover(c);
            setCropPhoto(null);
            if (photoInputRef.current) photoInputRef.current.value = "";
          }}
          onCancel={() => {
            setCropPhoto(null);
            if (photoInputRef.current) photoInputRef.current.value = "";
          }}
        />
      )}
    </>
  );
}