"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  NICK_COLORS,
  PROFILE_BACKGROUNDS,
  PROFILE_FRAMES,
  SOCIAL_KEYS,
  SOCIAL_LABELS,
  nickColorValue,
  profileBackgroundStyle,
  profileFrameStyle,
  type SocialKey,
} from "@/lib/profileCustomization";
import ProfileBannerCropModal from "./ProfileBannerCropModal";

export interface AchievementOption {
  id: number;
  title: string;
  description: string | null;
  frame: string;
  createdAt: number;
}

const FRAME_COLORS: Record<string, string> = {
  task: "var(--mc-green-light)",
  goal: "var(--mc-gold)",
  challenge: "#a855f7",
};

function normalizedSocials(input: Partial<Record<SocialKey, string>>) {
  return Object.fromEntries(
    SOCIAL_KEYS.map((key) => [key, (input[key] ?? "").trim()]).filter(([, value]) => value)
  );
}

export default function ProfileCustomizationForm({
  initialStatus,
  initialNickColor,
  initialProfileBg,
  initialProfileFrame,
  initialBgImage,
  bgUnlocked,
  unlockedFrames,
  initialSocials,
  initialFeatured,
  achievements,
}: {
  initialStatus: string;
  initialNickColor: string;
  initialProfileBg: string;
  initialProfileFrame: string;
  initialBgImage: string;
  bgUnlocked: boolean;
  unlockedFrames: string[];
  initialSocials: Partial<Record<SocialKey, string>>;
  initialFeatured: number[];
  achievements: AchievementOption[];
}) {
  const router = useRouter();
  const initialFrameValue = unlockedFrames.includes(initialProfileFrame)
    ? initialProfileFrame
    : "";
  const [status, setStatus] = useState(initialStatus);
  const [nickColor, setNickColor] = useState(initialNickColor);
  const [profileBg, setProfileBg] = useState(initialProfileBg);
  const [profileFrame, setProfileFrame] = useState(initialFrameValue);
  const [socials, setSocials] = useState<Partial<Record<SocialKey, string>>>(initialSocials);
  const [featured, setFeatured] = useState<number[]>(initialFeatured);
  const [bgImage, setBgImage] = useState(initialBgImage);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [bgError, setBgError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const bgFileRef = useRef<HTMLInputElement>(null);

  const colorPickerValue = nickColorValue(nickColor) ?? "#7dbb52";
  const availableFrames = PROFILE_FRAMES.filter(
    (frame) => frame.id === "none" || unlockedFrames.includes(frame.id)
  );

  const initialSnapshot = JSON.stringify({
    status: initialStatus,
    nickColor: initialNickColor,
    profileBg: initialProfileBg,
    profileFrame: initialFrameValue,
    socials: normalizedSocials(initialSocials),
    featured: initialFeatured,
  });
  const currentSnapshot = JSON.stringify({
    status,
    nickColor,
    profileBg,
    profileFrame,
    socials: normalizedSocials(socials),
    featured,
  });
  const dirty = initialSnapshot !== currentSnapshot;

  async function uploadBg(blob: Blob) {
    if (!bgUnlocked || uploading) return;
    setUploading(true);
    setBgError(null);
    setMessage(null);
    try {
      const formData = new FormData();
      const ext = blob.type === "image/png" ? "png" : "webp";
      formData.append("file", blob, `profile-bg.${ext}`);
      const res = await fetch("/api/user/profile-bg", { method: "POST", body: formData });
      const data = (await res.json()) as { error?: string; profileBgImage?: string };
      if (!res.ok || !data.profileBgImage) {
        throw new Error(data.error || "Не удалось загрузить фон");
      }
      setBgImage(data.profileBgImage);
      setProfileBg("");
      setMessage("Свой фон загружен");
      router.refresh();
    } catch (e) {
      setBgError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setUploading(false);
    }
  }

  async function removeBg() {
    if (uploading) return;
    setUploading(true);
    setBgError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/user/profile-bg", { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Не удалось удалить фон");
      setBgImage("");
      setMessage("Свой фон удалён");
      router.refresh();
    } catch (e) {
      setBgError(e instanceof Error ? e.message : "Ошибка удаления");
    } finally {
      setUploading(false);
    }
  }

  function toggleFeatured(id: number) {
    setFeatured((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  }

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          nickColor,
          profileBg,
          profileFrame,
          socials,
          featuredAchievements: featured,
        }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) throw new Error(data.error || "Не удалось сохранить профиль");
      if (profileBg) setBgImage("");
      setMessage(data.message ?? "Профиль сохранён");
      router.refresh();
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "Ошибка сети");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mc-panel overflow-hidden">
      <div className="mc-head">
        <h2 className="min-w-0 flex-1">Оформление профиля</h2>
      </div>
      <form onSubmit={save} className="flex flex-col gap-6 p-6">
        <div className="max-w-md">
          <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
            Статус
            <input
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              maxLength={30}
              placeholder="Например: строю город мечты"
              className="mc-input"
            />
            <span className="self-end font-mono text-[0.58rem]">{status.length}/30</span>
          </label>
        </div>

        <section>
          <h3 className="mb-2 text-sm font-bold uppercase tracking-[0.1em]">Цвет ника</h3>
          <div className="flex flex-wrap items-center gap-2">
            {NICK_COLORS.map((color) => (
              <button
                key={color.id}
                type="button"
                onClick={() => setNickColor(color.id === "default" ? "" : color.id)}
                className={`flex items-center gap-2 border-2 px-2.5 py-1.5 text-xs transition-colors ${
                  nickColor === color.id || (color.id === "default" && !nickColor)
                    ? "border-black bg-[var(--mc-green)] text-[#0f1a08]"
                    : "border-black bg-[var(--bg)] text-[var(--text-secondary)] hover:bg-[var(--hover)]"
                }`}
              >
                <span
                  className="h-3 w-3 border border-black"
                  style={{ backgroundColor: color.color || "var(--text)" }}
                />
                {color.label}
              </button>
            ))}
            <label className="flex items-center gap-2 border-2 border-black bg-[var(--bg)] px-2 py-1 text-xs text-[var(--text-muted)]">
              Свой
              <input
                type="color"
                value={colorPickerValue}
                onChange={(e) => setNickColor(e.target.value)}
                className="h-6 w-8 cursor-pointer border-0 bg-transparent p-0"
                aria-label="Свой цвет ника"
              />
            </label>
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-bold uppercase tracking-[0.1em]">Фон профиля</h3>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-7">
            {PROFILE_BACKGROUNDS.map((bg) => {
              const active = (profileBg || "default") === bg.id;
              return (
                <button
                  key={bg.id}
                  type="button"
                  onClick={() => setProfileBg(bg.id === "default" ? "" : bg.id)}
                  className={`flex flex-col overflow-hidden border-2 text-left transition-transform hover:-translate-y-0.5 ${
                    active ? "border-[var(--mc-green-light)]" : "border-black"
                  }`}
                >
                  <span
                    className={`block h-10 w-full ${bg.id === "default" ? "mc-hero-bg" : ""}`}
                    style={bg.id === "default" ? undefined : profileBackgroundStyle(bg.id)}
                  />
                  <span className="bg-[var(--card)] px-1.5 py-1 text-[0.58rem] text-[var(--text-secondary)]">
                    {bg.label}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-3 border-2 border-black bg-[var(--bg)] p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Свой фон</div>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                  {bgUnlocked
                    ? "PNG, JPEG или WebP до 8 МБ. Загрузка применяется сразу и заменяет пресет."
                    : "Разовая покупка в магазине — 100 BLD."}
                </p>
              </div>
              {!bgUnlocked && (
                <Link href="/shop" className="mc-btn mc-btn-primary px-3 py-1.5 text-xs">
                  Купить в магазине
                </Link>
              )}
            </div>

            {bgUnlocked && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <div
                  className="h-16 w-40 border-2 border-black bg-[var(--card-alt)] bg-cover bg-center"
                  style={bgImage ? { backgroundImage: `url(${bgImage})` } : undefined}
                  title={bgImage ? "Текущий фон" : "Фон не загружен"}
                />
                <input
                  ref={bgFileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 8 * 1024 * 1024) {
                        setBgError("Файл больше 8 МБ");
                      } else {
                        setBgError(null);
                        setCropFile(file);
                      }
                    }
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => bgFileRef.current?.click()}
                  disabled={uploading}
                  className="mc-btn px-3 py-1.5 text-xs"
                >
                  {uploading ? "Загружаем…" : bgImage ? "Заменить" : "Загрузить"}
                </button>
                {bgImage && (
                  <button
                    type="button"
                    onClick={() => void removeBg()}
                    disabled={uploading}
                    className="mc-btn px-3 py-1.5 text-xs text-[var(--mc-red)]"
                  >
                    Удалить
                  </button>
                )}
              </div>
            )}
            {bgError && <p className="mt-2 text-xs text-[var(--mc-red)]">{bgError}</p>}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-bold uppercase tracking-[0.1em]">Рамка аватара</h3>
          <div className="flex flex-wrap gap-2">
            {availableFrames.map((frame) => {
              const active = (profileFrame || "none") === frame.id;
              return (
                <button
                  key={frame.id}
                  type="button"
                  onClick={() => setProfileFrame(frame.id === "none" ? "" : frame.id)}
                  className={`flex items-center gap-2 border-2 px-2.5 py-1.5 text-xs transition-colors ${
                    active
                      ? "border-black bg-[var(--mc-green)] text-[#0f1a08]"
                      : "border-black bg-[var(--bg)] text-[var(--text-secondary)] hover:bg-[var(--hover)]"
                  }`}
                >
                  <span
                    className="h-4 w-4 border-2 border-black bg-[var(--card-alt)]"
                    style={frame.id === "none" ? undefined : profileFrameStyle(frame.id)}
                  />
                  {frame.label}
                </button>
              );
            })}
          </div>
          {unlockedFrames.length === 0 && (
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              Пока доступна только «Без рамки».{" "}
              <Link href="/shop" className="text-[var(--mc-green-light)] underline">
                Рамки продаются в магазине
              </Link>
              .
            </p>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-sm font-bold uppercase tracking-[0.1em]">Соцсети</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {SOCIAL_KEYS.map((key) => (
              <label key={key} className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
                {SOCIAL_LABELS[key]}
                <input
                  value={socials[key] ?? ""}
                  onChange={(e) =>
                    setSocials((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                  placeholder={
                    key === "website"
                      ? "https://example.com"
                      : key === "discord"
                        ? "username или ссылка"
                        : `@${key}`
                  }
                  className="mc-input"
                />
              </label>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-1 text-sm font-bold uppercase tracking-[0.1em]">
            Витрина достижений
          </h3>
          <p className="mb-2 text-xs text-[var(--text-muted)]">
            Выбери до 3 достижений, которые будут видны в профиле. Сейчас выбрано:{" "}
            {featured.length}/3.
          </p>
          {achievements.length === 0 ? (
            <p className="mc-inset p-3 text-sm text-[var(--text-muted)]">
              У тебя пока нет достижений — они появятся, когда сервер их пришлёт.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {achievements.map((achievement) => {
                const active = featured.includes(achievement.id);
                return (
                  <button
                    key={achievement.id}
                    type="button"
                    onClick={() => toggleFeatured(achievement.id)}
                    className={`flex items-start gap-2 border-2 p-2.5 text-left text-sm transition-colors ${
                      active
                        ? "border-[var(--mc-green-light)] bg-[rgba(93,156,60,0.14)]"
                        : "border-black bg-[var(--bg)] hover:bg-[var(--hover)]"
                    }`}
                  >
                    <span
                      className="mt-1 h-2.5 w-2.5 shrink-0"
                      style={{
                        backgroundColor: FRAME_COLORS[achievement.frame] ?? "var(--mc-green-light)",
                      }}
                      aria-hidden
                    />
                    <span className="min-w-0">
                      <span className="block font-semibold">{achievement.title}</span>
                      {achievement.description && (
                        <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
                          {achievement.description}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {error && (
          <p className="border-2 border-black bg-[rgba(214,69,69,0.14)] px-3 py-2 text-sm text-[var(--mc-red)]">
            {error}
          </p>
        )}
        {message && (
          <p className="border-2 border-black bg-[rgba(93,156,60,0.16)] px-3 py-2 text-sm text-[var(--mc-green-light)]">
            {message}
          </p>
        )}

        <div>
          <button
            type="submit"
            disabled={saving || !dirty}
            className="mc-btn mc-btn-primary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-55"
          >
            {saving ? "Сохраняем…" : dirty ? "Сохранить оформление" : "Нет изменений"}
          </button>
        </div>
      </form>

      {cropFile && (
        <ProfileBannerCropModal
          file={cropFile}
          onCancel={() => setCropFile(null)}
          onConfirm={(blob) => {
            setCropFile(null);
            void uploadBg(blob);
          }}
        />
      )}
    </div>
  );
}
