/**
 * Ежедневный бонус «колесо удачи»: призы и правила.
 *
 * Модуль общий для сервера и клиента: сервер выбирает приз по весам и
 * начисляет его, а колесо на клиенте показывает тот же список секторов.
 * Меняешь порядок/суммы здесь — колесо и выдача меняются вместе.
 */

export type DailyPrizeKind = "bld" | "chips";

export interface DailyPrize {
  kind: DailyPrizeKind;
  amount: number;
  /** Вес в розыгрыше: чем больше, тем чаще выпадает. Сумма весов = 100. */
  weight: number;
}

/**
 * Секторы колеса по часовой стрелке. Цвета чередуются, поэтому призы
 * разложены так, чтобы BLD и фишки шли вперемешку.
 */
export const DAILY_PRIZES: DailyPrize[] = [
  { kind: "bld", amount: 1, weight: 23 },
  { kind: "chips", amount: 25, weight: 20 },
  { kind: "bld", amount: 3, weight: 17 },
  { kind: "chips", amount: 50, weight: 15 },
  { kind: "bld", amount: 5, weight: 12 },
  { kind: "chips", amount: 100, weight: 8 },
  { kind: "bld", amount: 10, weight: 4 },
  { kind: "bld", amount: 25, weight: 1 },
];

/**
 * Ежедневный бонус сбрасывается в полночь по Москве. Часовой пояс зашит
 * константой: сервер может стоять в другом поясе, а игроки ждут сброс
 * «в свой день». Москва без перехода на летнее время, поэтому границы
 * дня стабильные.
 */
export const DAILY_BONUS_TIMEZONE = "Europe/Moscow";

/** Ключ календарного дня в часовом поясе бонуса: "2026-10-23". */
export function dailyBonusDayKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DAILY_BONUS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Смещение часового пояса бонуса относительно UTC для конкретного момента. */
function timezoneOffsetMs(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: DAILY_BONUS_TIMEZONE,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second")
  );
  return asUtc - date.getTime();
}

/** Начало текущего календарного дня бонуса (Date в UTC-момент). */
export function startOfDailyBonusDay(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DAILY_BONUS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const midnight = Date.UTC(get("year"), get("month") - 1, get("day"), 0, 0, 0);
  return new Date(midnight - timezoneOffsetMs(now));
}

/** Момент следующего сброса бонуса — ближайшая полночь по Москве. */
export function nextDailyBonusReset(now = new Date()): Date {
  return new Date(startOfDailyBonusDay(now).getTime() + 24 * 60 * 60 * 1000);
}

/**
 * Доступен ли прокрут: последний прокрут был в другой календарный день.
 * Сравниваем именно дни, а не 24 часа — так сброс происходит в полночь.
 */
export function isDailySpinAvailable(lastSpinAt: Date | null, now = new Date()): boolean {
  if (!lastSpinAt) return true;
  return dailyBonusDayKey(lastSpinAt) !== dailyBonusDayKey(now);
}

/** Подпись приза: «5 BLD» или «50 фишек». */
export function dailyPrizeLabel(prize: Pick<DailyPrize, "kind" | "amount">): string {
  return prize.kind === "bld" ? `${prize.amount} BLD` : `${prize.amount} фишек`;
}

/** Случайный индекс приза с учётом весов (0..DAILY_PRIZES.length - 1). */
export function pickDailyPrizeIndex(random: () => number = Math.random): number {
  const total = DAILY_PRIZES.reduce((sum, prize) => sum + prize.weight, 0);
  let roll = random() * total;
  for (let i = 0; i < DAILY_PRIZES.length; i++) {
    roll -= DAILY_PRIZES[i].weight;
    if (roll < 0) return i;
  }
  return DAILY_PRIZES.length - 1;
}
