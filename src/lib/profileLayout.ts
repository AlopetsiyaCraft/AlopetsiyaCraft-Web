/**
 * Блоки вкладки «Обзор» в профиле (osu!-стиль).
 *
 * Игрок сам выбирает порядок, ширину и видимость блоков. В БД лежит только
 * JSON-массив сохранённых блоков; недостающие блоки добавляются из дефолта,
 * чтобы новые блоки появлялись у всех без миграции данных.
 */

export const PROFILE_BLOCKS = [
  { id: "stats", label: "Статистика", hint: "Часы, смерти, блоки и прочие цифры" },
  { id: "radar", label: "Радар", hint: "График по всем категориям" },
  { id: "top", label: "Топы", hint: "Места в общем рейтинге сервера" },
  { id: "achievements", label: "Достижения", hint: "Последние или закреплённые" },
  { id: "season", label: "Сезон", hint: "Текущий сезон сервера" },
  { id: "friends", label: "Друзья", hint: "Принятые друзья" },
  { id: "photos", label: "Фото", hint: "Последние скриншоты" },
  { id: "audio", label: "Аудио", hint: "Последние треки" },
] as const;

export type ProfileBlockId = (typeof PROFILE_BLOCKS)[number]["id"];
export type ProfileBlockWidth = "full" | "half";

export interface ProfileBlock {
  id: ProfileBlockId;
  visible: boolean;
  width: ProfileBlockWidth;
}

export const PROFILE_BLOCK_IDS = PROFILE_BLOCKS.map((block) => block.id);

export const DEFAULT_PROFILE_LAYOUT: ProfileBlock[] = [
  { id: "stats", visible: true, width: "full" },
  { id: "radar", visible: true, width: "half" },
  { id: "top", visible: true, width: "half" },
  { id: "achievements", visible: true, width: "half" },
  { id: "season", visible: true, width: "half" },
  { id: "friends", visible: true, width: "half" },
  { id: "photos", visible: true, width: "half" },
  { id: "audio", visible: true, width: "half" },
];

function isBlockId(value: unknown): value is ProfileBlockId {
  return typeof value === "string" && PROFILE_BLOCK_IDS.includes(value as ProfileBlockId);
}

/**
 * Разбирает сохранённую раскладку и дополняет её новыми блоками.
 * Неизвестные id игнорируются, дубликаты схлопываются.
 */
export function parseProfileLayout(raw: string | null | undefined): ProfileBlock[] {
  if (!raw) return DEFAULT_PROFILE_LAYOUT.map((block) => ({ ...block }));

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return DEFAULT_PROFILE_LAYOUT.map((block) => ({ ...block }));
  }
  if (!Array.isArray(parsed)) return DEFAULT_PROFILE_LAYOUT.map((block) => ({ ...block }));

  const result: ProfileBlock[] = [];
  const seen = new Set<ProfileBlockId>();
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const block = item as Record<string, unknown>;
    if (!isBlockId(block.id) || seen.has(block.id)) continue;
    seen.add(block.id);
    result.push({
      id: block.id,
      visible: block.visible !== false,
      width: block.width === "full" ? "full" : "half",
    });
  }

  for (const fallback of DEFAULT_PROFILE_LAYOUT) {
    if (!seen.has(fallback.id)) result.push({ ...fallback });
  }
  return result;
}

/** Проверяет и нормализует раскладку из API. */
export function normalizeProfileLayout(input: unknown): ProfileBlock[] | null {
  if (!Array.isArray(input)) return null;
  const result: ProfileBlock[] = [];
  const seen = new Set<ProfileBlockId>();
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const block = item as Record<string, unknown>;
    if (!isBlockId(block.id) || seen.has(block.id)) continue;
    seen.add(block.id);
    result.push({
      id: block.id,
      visible: block.visible !== false,
      width: block.width === "full" ? "full" : "half",
    });
  }
  for (const fallback of DEFAULT_PROFILE_LAYOUT) {
    if (!seen.has(fallback.id)) result.push({ ...fallback });
  }
  return result;
}
