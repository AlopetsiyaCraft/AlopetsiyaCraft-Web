/**
 * Кастомизация профиля: пресеты цветов, фонов, рамок и соцсетей.
 * Модуль общий для сервера и клиента — меняешь пресеты в одном месте.
 */

export const NICK_COLORS = [
  { id: "default", label: "Обычный", color: "" },
  { id: "green", label: "Зелёный", color: "#7dbb52" },
  { id: "gold", label: "Золотой", color: "#f2c94c" },
  { id: "blue", label: "Синий", color: "#4a90e2" },
  { id: "purple", label: "Фиолетовый", color: "#a855f7" },
  { id: "red", label: "Красный", color: "#d64545" },
  { id: "white", label: "Белый", color: "#f4f4f4" },
] as const;

export type NickColorId = (typeof NICK_COLORS)[number]["id"];

export function nickColorValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const preset = NICK_COLORS.find((c) => c.id === value);
  if (preset) return preset.color || null;
  if (/^#[0-9a-f]{6}$/i.test(value)) return value;
  return null;
}

export const PROFILE_BACKGROUNDS = [
  { id: "default", label: "Пиксельный" },
  { id: "grass", label: "Трава" },
  { id: "nether", label: "Нижний мир" },
  { id: "end", label: "Энд" },
  { id: "ocean", label: "Океан" },
  { id: "sunset", label: "Закат" },
  { id: "night", label: "Ночь" },
] as const;

export type ProfileBgId = (typeof PROFILE_BACKGROUNDS)[number]["id"];

const BACKGROUND_STYLES: Record<string, string> = {
  grass: "linear-gradient(135deg,#16240f 0%,#3f6d28 45%,#5d9c3c 70%,#8b7355 100%)",
  nether: "linear-gradient(135deg,#250808 0%,#6b1717 50%,#d64545 100%)",
  end: "linear-gradient(135deg,#0f0a1e 0%,#2e1f4a 55%,#8b5cf6 100%)",
  ocean: "linear-gradient(135deg,#071a2b 0%,#1f4e79 50%,#4a90e2 100%)",
  sunset: "linear-gradient(135deg,#2a1020 0%,#b34a2f 55%,#f2c94c 100%)",
  night: "linear-gradient(135deg,#08080e 0%,#1b1b2b 55%,#3a3a5a 100%)",
};

/** CSS-фон профиля по id или кастомному #rrggbb. */
export function profileBackgroundStyle(value: string | null | undefined): {
  background?: string;
} {
  if (!value) return {};
  if (/^#[0-9a-f]{6}$/i.test(value)) {
    return {
      background: `linear-gradient(135deg, #0d0d0d 0%, ${value} 100%)`,
    };
  }
  const bg = BACKGROUND_STYLES[value];
  return bg ? { background: bg } : {};
}

export const PROFILE_FRAMES = [
  { id: "none", label: "Без рамки", color: "" },
  { id: "gold", label: "Золотая", color: "#f2c94c" },
  { id: "green", label: "Изумрудная", color: "#7dbb52" },
  { id: "purple", label: "Аметистовая", color: "#a855f7" },
  { id: "blue", label: "Алмазная", color: "#4a90e2" },
  { id: "red", label: "Редстоун", color: "#d64545" },
] as const;

export type ProfileFrameId = (typeof PROFILE_FRAMES)[number]["id"];

/** Стиль рамки вокруг аватара. */
export function profileFrameStyle(value: string | null | undefined): {
  boxShadow?: string;
} {
  const frame = PROFILE_FRAMES.find((f) => f.id === value);
  if (!frame || !frame.color) return {};
  return {
    boxShadow: `0 0 0 4px ${frame.color}, 4px 4px 0 rgba(0,0,0,0.55)`,
  };
}

export const SOCIAL_KEYS = [
  "discord",
  "telegram",
  "youtube",
  "twitch",
  "github",
  "website",
] as const;

export type SocialKey = (typeof SOCIAL_KEYS)[number];

export const SOCIAL_LABELS: Record<SocialKey, string> = {
  discord: "Discord",
  telegram: "Telegram",
  youtube: "YouTube",
  twitch: "Twitch",
  github: "GitHub",
  website: "Сайт",
};

export type Socials = Partial<Record<SocialKey, string>>;

/** Разбор JSON-соцсетей с защитой от мусора. */
export function parseSocials(raw: string | null | undefined): Socials {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const result: Socials = {};
    for (const key of SOCIAL_KEYS) {
      const value = parsed[key];
      if (typeof value === "string" && value.trim()) {
        result[key] = value.trim().slice(0, 200);
      }
    }
    return result;
  } catch {
    return {};
  }
}

/** Безопасная ссылка для соцсети: только http(s), остальное — префиксы. */
export function socialHref(key: SocialKey, raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (key === "website") {
    return /^https?:\/\//i.test(value) ? value : `https://${value}`;
  }
  if (key === "discord") {
    return /^https?:\/\//i.test(value) ? value : null;
  }
  const handle = value.replace(/^@/, "").replace(/^https?:\/\/[^/]+\//i, "").replace(/\/$/, "");
  if (!handle) return null;
  switch (key) {
    case "telegram":
      return `https://t.me/${handle}`;
    case "youtube":
      return /^https?:\/\//i.test(value) ? value : `https://youtube.com/@${handle}`;
    case "twitch":
      return `https://twitch.tv/${handle}`;
    case "github":
      return `https://github.com/${handle}`;
    default:
      return null;
  }
}

/** Разбор id закреплённых достижений. */
export function parseFeaturedAchievements(raw: string | null | undefined): number[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0)
      .slice(0, 3);
  } catch {
    return [];
  }
}
