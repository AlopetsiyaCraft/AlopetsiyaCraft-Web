import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { playerInventories } from "@/lib/db/schema";
import { checkBridgeKey } from "@/lib/bridge";
import { CONTAINER_SIZES, type InventoryStack } from "@/lib/inventory";
import { sql } from "drizzle-orm";

const MAX_NICKNAME = 32;
const MAX_STACK_NAME = 120;
// Отбрасываем «мусорные» предметы, если мод вдруг прислал что-то левое.
const MAX_ITEM_ID = 64;
const MAX_LORE_LINES = 20;
const MAX_LORE_CHARS = 300;
const MAX_ENCHANTMENTS = 32;
/** Лимит на размер JSON, чтобы мод не мог положить сайт гигантским ответом. */
const MAX_DATA_BYTES = 512 * 1024;

/**
 * Мост инвентарей: мод AlopetsiyaInventory шлёт снимок инвентаря игрока при
 * выходе с сервера (и при входе / остановке сервера).
 *
 * POST /api/inventory/from-server  — тело:
 *   {
 *     nickname: "Steve",
 *     containers: { main: [null|stack…36], armor: [4], offhand: [1], enderChest: [27] },
 *     xpLevel?, health?, healthMax?, food?, saturation?, updatedAt?
 *   }
 *   stack = { id: "minecraft:diamond_sword", count, name, [damage, maxDamage],
 *             [enchantments: [{id, lvl}]], [lore: [string]] }
 *
 * Ник хранится в нижнем регистре (в игре ники регистронезависимы), снимок на
 * пару (ник, данные) просто перезаписывается — у игрока всегда ровно один
 * «текущий» инвентарь. Требует header `x-api-key` = CHAT_API_KEY.
 */
export async function POST(request: NextRequest) {
  if (!checkBridgeKey(request.headers.get("x-api-key"))) {
    return NextResponse.json({ error: "Неверный ключ API" }, { status: 401 });
  }

  const raw = await request.text().catch(() => "");
  if (!raw) return NextResponse.json({ error: "Пустое тело" }, { status: 400 });
  if (raw.length > MAX_DATA_BYTES) {
    return NextResponse.json({ error: "Слишком большой снимок инвентаря" }, { status: 413 });
  }

  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const nickname =
    typeof body?.nickname === "string" ? body.nickname.trim().slice(0, MAX_NICKNAME) : "";
  if (!nickname) {
    return NextResponse.json({ error: "Поле nickname обязательно" }, { status: 400 });
  }
  if (!body.containers || typeof body.containers !== "object") {
    return NextResponse.json({ error: "Поле containers обязательно" }, { status: 400 });
  }

  // Собираем «чистую» копию: фиксированная длина контейнеров, валидные поля.
  const containers: Record<string, (InventoryStack | null)[]> = {};
  for (const [key, size] of Object.entries(CONTAINER_SIZES)) {
    const src = Array.isArray(body.containers[key]) ? body.containers[key] : [];
    const cleaned: (InventoryStack | null)[] = [];
    for (let i = 0; i < size; i++) {
      cleaned.push(cleanStack(src[i]));
    }
    containers[key] = cleaned;
  }

  const cleaned: any = {
    nickname,
    containers,
  };
  for (const num of ["xpLevel", "health", "healthMax", "food", "saturation", "updatedAt"] as const) {
    if (typeof body[num] === "number" && Number.isFinite(body[num])) {
      cleaned[num] = body[num];
    }
  }

  try {
    await db
      .insert(playerInventories)
      .values({
        nickname: nickname.toLowerCase(),
        displayNickname: nickname,
        data: JSON.stringify(cleaned),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: playerInventories.nickname,
        set: {
          displayNickname: sql`excluded.display_nickname`,
          data: sql`excluded.data`,
          updatedAt: sql`excluded.updated_at`,
        },
      })
      .run();
  } catch (error) {
    console.error("Inventory bridge error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }

  return NextResponse.json({ message: "OK" });
}

function cleanStack(raw: any): InventoryStack | null {
  if (!raw || typeof raw !== "object") return null;
  const id = typeof raw.id === "string" ? raw.id.trim().slice(0, MAX_ITEM_ID) : "";
  if (!id || id === "minecraft:air") return null;

  const stack: InventoryStack = {
    id: id.toLowerCase(),
    count: typeof raw.count === "number" && raw.count > 0 ? Math.min(99, Math.floor(raw.count)) : 1,
    name: typeof raw.name === "string" ? String(raw.name).trim().slice(0, MAX_STACK_NAME) : id,
  };
  if (typeof raw.damage === "number") stack.damage = Math.max(0, Math.floor(raw.damage));
  if (typeof raw.maxDamage === "number") stack.maxDamage = Math.max(1, Math.floor(raw.maxDamage));

  if (Array.isArray(raw.enchantments)) {
    const ench = raw.enchantments
      .filter((e: any) => e && typeof e.id === "string")
      .slice(0, MAX_ENCHANTMENTS)
      .map((e: any) => ({ id: String(e.id).slice(0, MAX_ITEM_ID), lvl: Math.min(255, Math.floor(Number(e.lvl) || 1)) }));
    if (ench.length) stack.enchantments = ench;
  }

  if (Array.isArray(raw.lore)) {
    const lore = raw.lore
      .filter((l: any) => typeof l === "string" && l.trim())
      .slice(0, MAX_LORE_LINES)
      .map((l: string) => l.slice(0, MAX_LORE_CHARS));
    if (lore.length) stack.lore = lore;
  }

  return stack;
}