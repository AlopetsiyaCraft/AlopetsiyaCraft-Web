"use client";

import { useEffect, useRef, useState } from "react";
import type { AlbumsListItem } from "@/lib/profile";

export interface SeasonOption {
  id: number;
  number: number;
  name: string;
}

/** Мультипарт-загрузка фото. Сезон обязателен; альбом/видимость/подпись — опционально. */
export default function PhotoUploader({
  seasons,
  fixedSeasonId,
  onUploaded,
}: {
  seasons: SeasonOption[];
  fixedSeasonId?: number | null;
  onUploaded?: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [seasonId, setSeasonId] = useState<number | null>(fixedSeasonId ?? null);
  const [albumId, setAlbumId] = useState<string>("");
  const [visibility, setVisibility] = useState<"public" | "registered">("public");
  const [caption, setCaption] = useState("");
  const [albums, setAlbums] = useState<AlbumsListItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/albums")
      .then((r) => r.json())
      .then((data: AlbumsListItem[]) => setAlbums(data))
      .catch(() => setAlbums([]));
  }, []);

  useEffect(() => {
    if (fixedSeasonId) setSeasonId(fixedSeasonId);
  }, [fixedSeasonId]);

  function pickFile(f: File | undefined) {
    if (!f) return;
    if (!/\.(jpg|jpeg|png|webp|gif)$/i.test(f.name)) {
      setError("Только изображения: jpg, png, webp, gif");
      return;
    }
    if (f.size > 12 * 1024 * 1024) {
      setError("Файл больше 12 МБ");
      return;
    }
    setFile(f);
    setError(null);
    setSuccess(null);
    setPreview(URL.createObjectURL(f));
  }

  async function upload() {
    if (!file) return;
    if (!seasonId) {
      setError("Нужно выбрать сезон — фото попадёт в галерею сезона");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("seasonId", String(seasonId));
      if (albumId) fd.append("albumId", albumId);
      fd.append("visibility", visibility);
      fd.append("caption", caption);

      const res = await fetch("/api/photos", { method: "POST", body: fd });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(j?.error ?? "Ошибка загрузки");
      }
      setSuccess("Фото загружено!");
      setFile(null);
      setPreview(null);
      setCaption("");
      setAlbumId("");
      if (fileRef.current) fileRef.current.value = "";
      onUploaded?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setUploading(false);
    }
  }

  const fixed = !!fixedSeasonId;

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
      <h3 className="text-sm font-semibold mb-3">Загрузить фото</h3>
      <div className="flex flex-col md:flex-row gap-4">
        <div
          onClick={() => fileRef.current?.click()}
          className="md:w-48 h-32 border-2 border-dashed border-[var(--border)] hover:border-[#7c3aed]/50 rounded-lg flex items-center justify-center cursor-pointer overflow-hidden"
        >
          {preview ? (
            <img src={preview} alt="Предпросмотр" className="w-full h-full object-cover" />
          ) : (
            <div className="text-center text-[var(--text-muted)] text-xs px-2">
              <div className="text-2xl mb-1">📷</div>
              Выбрать файл
            </div>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.gif,image/*"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0])}
        />

        <div className="flex-1 space-y-3">
          {fixed ? (
            <p className="text-sm text-[var(--text-secondary)]">
              Сезон: <span className="text-[var(--text)]">{seasons.find((s) => s.id === seasonId)?.number ?? ""}</span>
            </p>
          ) : (
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">
                Сезон <span className="text-red-400">*</span>
              </label>
              <select
                value={seasonId ?? ""}
                onChange={(e) => setSeasonId(e.target.value ? parseInt(e.target.value, 10) : null)}
                className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm"
              >
                <option value="">Выберите сезон…</option>
                {seasons.map((s) => (
                  <option key={s.id} value={s.id}>
                    Сезон {s.number} — {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Альбом (необязательно)</label>
              <select
                value={albumId}
                onChange={(e) => setAlbumId(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm"
              >
                <option value="">Без альбома</option>
                {albums.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Кто будет видеть</label>
              <div className="flex gap-2">
                {(["public", "registered"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setVisibility(v)}
                    type="button"
                    className={`flex-1 px-2 py-1.5 rounded-lg text-xs border transition-colors ${
                      visibility === v
                        ? "bg-[#7c3aed] border-[#7c3aed] text-white"
                        : "bg-[var(--bg)] border-[var(--border)] text-[var(--text)] hover:border-[#7c3aed]/50"
                    }`}
                  >
                    {v === "public" ? "Всем" : "Только зарегистрированным"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={200}
            placeholder="Подпись (необязательно)"
            className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[#7c3aed]"
          />

          <div className="flex items-center gap-3">
            <button
              onClick={upload}
              disabled={!file || uploading}
              className="px-4 py-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? "Загружаем…" : "Загрузить"}
            </button>
            {error && <span className="text-sm text-red-400">{error}</span>}
            {success && <span className="text-sm text-green-500">{success}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}