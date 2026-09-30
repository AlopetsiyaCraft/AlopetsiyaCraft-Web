/**
 * Валюты сайта: Болды (BLD) и Фишки (chips).
 *
 * Болды — «внутренняя» валюта: покупки на сайте (пластинки и т.п.).
 * Фишки — тратятся только за карточными столами в Minecraft.
 *
 * Правила обмена (выбранный вариант — простой, без комиссии):
 *   - 1 BLD = CHIPS_PER_BLD фишек.
 *   - Фишки → болды только целыми «пачками» по CHIPS_PER_BLD:
 *     остаток меньше одной пачки остаётся фишками на счету.
 *
 * Если позже захотим «биржевой» спред ~5% — заменить SELL_CHIPS_PER_BLD
 * на 26 (покупка фишек 1:25 без комиссии, обратный обмен 26 фишек = 1 болд).
 */
export type Currency = "bld" | "chips";

/** Сколько фишек дают за 1 болд (и сколько фишек нужно за 1 болд обратно). */
export const CHIPS_PER_BLD = 25;

/** Сколько фишек нужно вернуть за 1 болд (сейчас = покупному курсу, без спреда). */
export const SELL_CHIPS_PER_BLD = CHIPS_PER_BLD;

/** Стоимость заказа кастомной пластинки в болдах. */
export const DISC_PRICE_BLD = 10;

/** Болды → фишки: ровно amount * CHIPS_PER_BLD. */
export function bldToChips(amount: number): number {
  return amount * CHIPS_PER_BLD;
}

/** Сколько болдов дадут за amount фишек (целые пачки по SELL_CHIPS_PER_BLD). */
export function chipsToBld(amount: number): number {
  return Math.floor(amount / SELL_CHIPS_PER_BLD);
}

/** Сколько фишек фактически спишется при обмене amount фишек на болды. */
export function chipsSpentForBld(amount: number): number {
  return chipsToBld(amount) * SELL_CHIPS_PER_BLD;
}

/** 12 345 — русский формат числа с разделителями. */
export function formatCurrency(value: number): string {
  return value.toLocaleString("ru-RU");
}