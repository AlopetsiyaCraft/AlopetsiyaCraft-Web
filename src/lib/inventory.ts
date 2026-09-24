/** Типы и утилиты для инвентарей (страница /inventory, мост from-server). */

export interface InventoryStack {
  id: string;
  count: number;
  /** Отображаемое имя, как прислал сервер (может быть на любом языке). */
  name: string;
  damage?: number;
  maxDamage?: number;
  enchantments?: { id: string; lvl: number }[];
  lore?: string[];
}

export interface InventoryContainers {
  /** 36 слотов основного инвентаря (индекс = слот). */
  main: (InventoryStack | null)[];
  /** 4 слота брони: 0 — ботинки ... 3 — шлем. */
  armor: (InventoryStack | null)[];
  /** 1 слот оффхенда. */
  offhand: (InventoryStack | null)[];
  /** 27 слотов эндер-сундука. */
  enderChest: (InventoryStack | null)[];
}

export interface InventoryData {
  nickname: string;
  containers: InventoryContainers;
  xpLevel?: number;
  health?: number;
  healthMax?: number;
  food?: number;
  saturation?: number;
  updatedAt?: number;
}

export const CONTAINER_SIZES = {
  main: 36,
  armor: 4,
  offhand: 1,
  enderChest: 27,
} as const;

export type ContainerKey = keyof InventoryContainers;

/** Разбирает JSON из БД в валидный InventoryData (или null). */
export function parseInventoryData(text: string | null | undefined): InventoryData | null {
  if (!text) return null;
  try {
    const raw = JSON.parse(text);
    if (!raw || typeof raw !== "object" || !raw.containers) return null;
    const containers = raw.containers as Record<string, unknown>;
    const result: InventoryData = { nickname: String(raw.nickname ?? ""), containers: { main: [], armor: [], offhand: [], enderChest: [] } };

    for (const key of Object.keys(CONTAINER_SIZES) as ContainerKey[]) {
      const list = Array.isArray(containers[key]) ? (containers[key] as unknown[]) : [];
      const size = CONTAINER_SIZES[key];
      const arr: (InventoryStack | null)[] = [];
      for (let i = 0; i < size; i++) {
        const el = list[i] as Partial<InventoryStack> | null;
        if (!el || typeof el !== "object") {
          arr.push(null);
          continue;
        }
        const id = typeof el.id === "string" ? el.id.trim() : "";
        if (!id) {
          arr.push(null);
          continue;
        }
        arr.push({
          id: id.toLowerCase(),
          count: typeof el.count === "number" && el.count > 0 ? Math.floor(el.count) : 1,
          name: typeof el.name === "string" && el.name.trim() ? el.name.trim() : prettifyId(id),
          damage: typeof el.damage === "number" ? el.damage : undefined,
          maxDamage: typeof el.maxDamage === "number" ? el.maxDamage : undefined,
          enchantments: Array.isArray(el.enchantments)
            ? el.enchantments
                .filter((en: any) => en && typeof en.id === "string")
                .map((en: any) => ({ id: String(en.id), lvl: Math.floor(Number(en.lvl) || 1) }))
            : undefined,
          lore: Array.isArray(el.lore) ? el.lore.filter((l: any) => typeof l === "string") : undefined,
        });
      }
      result.containers[key] = arr;
    }

    if (typeof raw.xpLevel === "number") result.xpLevel = raw.xpLevel;
    if (typeof raw.health === "number") result.health = raw.health;
    if (typeof raw.healthMax === "number") result.healthMax = raw.healthMax;
    if (typeof raw.food === "number") result.food = raw.food;
    if (typeof raw.saturation === "number") result.saturation = raw.saturation;
    if (typeof raw.updatedAt === "number") result.updatedAt = raw.updatedAt;
    return result;
  } catch {
    return null;
  }
}

/** "minecraft:oak_log" → "Oak Log" — запасной вариант имени без базы имён. */
export function prettifyId(id: string): string {
  const name = id.includes(":") ? id.split(":")[1] ?? id : id;
  return name
    .split("_")
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Имя заклинания по ключу перевода ("minecraft:sharpness" → "Острота"). */
export function translateEnchantmentId(rawId: string, lang: Record<string, string>): string | null {
  const id = rawId.includes(":") ? rawId.split(":")[1] ?? rawId : rawId;
  return lang[`enchantment.minecraft.${id}`] ?? null;
}

/** Сколько предметов в одной «стопке» (для подписи x64 у label). */
export function stackMaxById(id: string): number | null {
  // Несколько исключений ванильных предметов со stack size 1/N.
  if (id.includes(":")) {
    const n = id.split(":")[1] ?? id;
    if (
      n === "ender_pearl" || n === "bucket" || n === "snowball" || n === "egg" ||
      n === "breeze_rod" || n === "wind_charge"
    ) {
      return 16;
    }
  }
  return 64;
}