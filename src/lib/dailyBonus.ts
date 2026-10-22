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

/** Прокрутить колесо можно раз в 24 часа. */
export const DAILY_SPIN_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/**
 * Истёк ли кулдаун с момента последнего прокрута.
 * Вынесено из компонента, чтобы серверная страница не звала Date.now()
 * прямо в теле рендера.
 */
export function isDailySpinAvailable(lastSpinAt: Date | null, now = Date.now()): boolean {
  if (!lastSpinAt) return true;
  return now - lastSpinAt.getTime() >= DAILY_SPIN_COOLDOWN_MS;
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
