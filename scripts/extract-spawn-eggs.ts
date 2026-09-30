import { readFileSync, writeFileSync } from "fs";

/**
 * Один раз вытаскивает цвета яиц призыва из исходников игры (Items.java)
 * и генерирует src/lib/spawnEggs.ts. В самой игре иконка яйца — это
 * текстура spawn_egg.png, покрашенная в backgroundColor/highlightColor
 * моба (SpawnEggItem.getColor), поэтому без этих чисел все яйца выглядят
 * одинаковыми.
 */
const SRC =
  "C:/Users/123/AppData/Local/Temp/opencode/achievementbridge/build/neoForm/neoFormJoined1.21.1-20240808.144430/steps/unzipSources/unpacked/net/minecraft/world/item/Items.java";
const OUT = "src/lib/spawnEggs.ts";

const java = readFileSync(SRC, "utf8");
const re = /registerItem\(\s*"([a-z0-9_]+)",\s*new SpawnEggItem\(\s*EntityType\.[A-Z0-9_]+\s*,\s*(\d+)\s*,\s*(\d+)/g;

const entries: Record<string, [number, number]> = {};
let m: RegExpExecArray | null;
while ((m = re.exec(java)) !== null) {
  const id = m[1]!;
  const bg = Number(m[2]!);
  const hi = Number(m[3]!);
  if (id.endsWith("_spawn_egg")) entries[id] = [bg, hi];
}

const keys = Object.keys(entries).sort();
console.log(`найдено яиц: ${keys.length}`);

const lines = keys.map((k) => `  "${k}": [${entries[k]![0]}, ${entries[k]![1]}],`);
const body = `/**
 * Цвета яиц призыва: id предмета → [backgroundColor, highlightColor].
 *
 * Файл сгенерирован из исходников игры (net/minecraft/world/item/Items.java).
 * В игре иконка яйца — базовая текстура spawn_egg + spawn_egg_overlay,
 * покрашенная этими цветами (SpawnEggItem#getColor). Без них все яйца
 * выглядят одинаковыми, поэтому таблица нужна рендереру иконок.
 *
 * Правь вручную не нужно: перегенерировать скриптом extract-spawn-eggs.
 */

export const SPAWN_EGG_COLORS: Record<string, readonly [number, number]> = {
${lines.join("\n")}
};

/** Цвета яйца по id предмета (без namespace), либо null. */
export function spawnEggColors(itemId: string): readonly [number, number] | null {
  const name = itemId.includes(":") ? itemId.slice(itemId.indexOf(":") + 1) : itemId;
  return SPAWN_EGG_COLORS[name] ?? null;
}
`;

writeFileSync(OUT, body, "utf8");
console.log(`записано ${OUT}`);
console.log("пример:", keys.slice(0, 3).map((k) => `${k}=${entries[k]}`).join(", "));