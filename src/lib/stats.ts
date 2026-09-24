/**
 * Категории статистики сервера и правила их отображения.
 *
 * Значения присылает мост (мод chatbridge или скрипт на хосте сервера) через
 * POST /api/stats/from-server: по каждому игроку — { [category]: число }.
 * Числа — сырые значения ванильной статистики Minecraft:
 *   - play_time      — в тиках (20 тиков = 1 секунда), на сайте показываем часы;
 *   - walk_one_cm    — в сантиметрах (как в stats/*.json), показываем км/м;
 *   - всё остальное  — как есть (смерти, убийства, добытые блоки...).
 *
 * В столбце `vanillas` — из каких ключей `minecraft:custom:minecraft:*` /
 * сумм `minecraft:killed:*` и т.п. мод собирает категорию (справка для мода).
 */

export type StatFormat = "raw" | "playtime" | "distance";

export interface StatCategory {
  key: string;
  /** Заголовок колонки/категории на сайте. */
  label: string;
  /** Короткое описание для подписи на странице. */
  hint: string;
  /** Какие ванильные статы собирает эта категория (справка для мода). */
  vanillas: string[];
  format: StatFormat;
}

export const STAT_CATEGORIES: StatCategory[] = [
  {
    key: "deaths",
    label: "Смертей",
    hint: "Сколько раз игрок погиб на сервере",
    vanillas: ["minecraft:custom:minecraft:deaths"],
    format: "raw",
  },
  {
    key: "mob_kills",
    label: "Убито мобов",
    hint: "Сколько мобов убито (все виды суммарно)",
    vanillas: ["сумма всех minecraft:killed:minecraft:*"],
    format: "raw",
  },
  {
    key: "player_kills",
    label: "Убито игроков",
    hint: "Сколько раз убиты другие игроки",
    vanillas: ["minecraft:custom:minecraft:player_kills"],
    format: "raw",
  },
  {
    key: "blocks_mined",
    label: "Блоков добыто",
    hint: "Сколько блоков сломано (все виды суммарно)",
    vanillas: ["сумма всех minecraft:mined:minecraft:*"],
    format: "raw",
  },
  {
    key: "walk_one_cm",
    label: "Пройдено пешком",
    hint: "Дистанция, пройденная пешком за всё время",
    vanillas: ["minecraft:custom:minecraft:walk_one_cm"],
    format: "distance",
  },
  {
    key: "damage_dealt",
    label: "Урона нанесено",
    hint: "Сколько урона нанесено (в хп)",
    vanillas: ["minecraft:custom:minecraft:damage_dealt"],
    format: "raw",
  },
  {
    key: "damage_taken",
    label: "Урона получено",
    hint: "Сколько урона получено (в хп)",
    vanillas: ["minecraft:custom:minecraft:damage_taken"],
    format: "raw",
  },
  {
    key: "jumps",
    label: "Прыжков",
    hint: "Сколько раз игрок прыгнул",
    vanillas: ["minecraft:custom:minecraft:jump"],
    format: "raw",
  },
  {
    key: "play_time",
    label: "Время в игре",
    hint: "Сколько всего времени игрок провёл на сервере",
    vanillas: ["minecraft:custom:minecraft:play_time (тики)"],
    format: "playtime",
  },
];

/** Ключ категории «время в игре» — всегда показывается отдельной колонкой. */
export const PLAY_TIME_KEY = "play_time";

export const STAT_CATEGORY_KEYS = new Set(STAT_CATEGORIES.map((c) => c.key));

/** Категория по ключу (или undefined, если ключ не из списка). */
export function getStatCategory(key: string): StatCategory | undefined {
  return STAT_CATEGORIES.find((c) => c.key === key);
}

/** Тики → часы, с аккуратной точностью: «12.4 ч», «213 ч». */
export function formatPlayTimeTicks(value: number): string {
  const hours = value / (20 * 3600);
  if (!Number.isFinite(hours) || hours <= 0) return "0 ч";
  const rounded = hours >= 100 ? Math.round(hours) : Math.round(hours * 10) / 10;
  return `${rounded.toLocaleString("ru-RU")} ч`;
}

/** Сантиметры (как в ванильных статах) → «1.2 км» / «340 м». */
export function formatDistanceCm(value: number): string {
  const km = value / 100000;
  if (km >= 1) return `${km >= 100 ? Math.round(km) : Math.round(km * 10) / 10} км`;
  const m = Math.round(value / 100);
  return `${m.toLocaleString("ru-RU")} м`;
}

/** Значение категории в человекочитаемом виде. */
export function formatStatValue(category: StatCategory, value: number): string {
  if (category.format === "playtime") return formatPlayTimeTicks(value);
  if (category.format === "distance") return formatDistanceCm(value);
  return value.toLocaleString("ru-RU");
}