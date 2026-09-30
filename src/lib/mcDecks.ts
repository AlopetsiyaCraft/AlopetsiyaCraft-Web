/**
 * Колоды charta: один предмет `charta:deck`, но в инвентаре у игрока их
 * несколько, и различаются они только названием стека («Russia Deck»).
 *
 * Мод рисует их кастомным рендерером (модель builtin/entity, плоской
 * текстуры у предмета нет), а обложка колоды лежит в jar рядом с её же
 * описанием: decks/flags/russia.png ↔ data/charta/decks/flags/russia.json.
 *
 * Поэтому ищем колоду по названию стека через переводы мода:
 *   en_us["deck.charta.flags.russia"] = "Russia Deck"  →  decks/flags/russia.png
 */

import { hasModExtra, listModData, readModData, readModLang } from "@/lib/mcMods";

/** Название стека → путь к картинке колоды внутри jar (без .png). */
const deckByName = new Map<string, string>();
let indexedNs = "";

/** §-коды в названиях предметов — просто отбрасываем при сравнении. */
function normalizeName(raw: string): string {
  return raw
    .replace(/§[0-9a-fk-or]/gi, "")
    .trim()
    .toLowerCase();
}

/** Строит (разово) таблицу «название стека → обложка». */
function ensureIndex(ns: string): void {
  if (indexedNs === ns) return;
  indexedNs = ns;

  const lang = readModLang(ns) ?? {};
  const byTranslation = new Map<string, string>();
  for (const [key, value] of Object.entries(lang)) {
    if (!key.startsWith("deck.")) continue;
    byTranslation.set(normalizeName(value), key);
  }

  for (const dataPath of listModData(ns, "decks/")) {
    const deck = readModData(ns, dataPath);
    const translationKey = typeof deck?.translation === "string" ? deck.translation : null;
    // Пути совпадают: data/<ns>/decks/flags/russia.json ↔ decks/flags/russia.png.
    const imagePath = dataPath;
    if (!hasModExtra(ns, imagePath)) continue;

    // Ключ перевода → имя, под которым предмет видит игрок.
    const displayName = translationKey ? lang[translationKey] : null;
    if (displayName) deckByName.set(normalizeName(displayName), imagePath);

    // Запасной путь: «Russia Deck» → «russia», даже если перевод не нашёлся.
    const tail = translationKey?.split(".").pop() ?? dataPath.split("/").pop() ?? "";
    if (tail) deckByName.set(normalizeName(`${tail.replace(/_/g, " ")} deck`), imagePath);
    if (tail) deckByName.set(normalizeName(tail), imagePath);
  }

  // Русский перевод тоже полезен: игрок может назвать колоду по-русски.
  for (const langCode of ["ru_ru"]) {
    const loc = readModLang(ns, langCode);
    if (!loc) continue;
    for (const [key, value] of Object.entries(loc)) {
      const imagePath = byTranslation.get(normalizeName(value));
      if (imagePath) deckByName.set(normalizeName(value), imagePath);
    }
  }
}

/**
 * Путь к картинке колоды для стека `charta:deck` с указанным названием.
 * null, если предмет — не колода или колоду не удалось опознать.
 */
export function resolveDeckImage(ns: string, itemName: string, stackName?: string | null): string | null {
  if (itemName !== "deck") return null;
  ensureIndex(ns);
  if (!stackName) return null;
  return deckByName.get(normalizeName(stackName)) ?? null;
}

/** Диагностика: сколько колод удалось опознать по названию. */
export function deckCount(ns: string): number {
  ensureIndex(ns);
  return deckByName.size;
}