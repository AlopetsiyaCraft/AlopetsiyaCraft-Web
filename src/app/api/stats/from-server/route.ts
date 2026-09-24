import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { playerStats } from "@/lib/db/schema";
import { checkBridgeKey } from "@/lib/bridge";
import { STAT_CATEGORY_KEYS, PLAY_TIME_KEY } from "@/lib/stats";

const MAX_PLAYERS = 500;
const MAX_NICKNAME = 32;
const MAX_CATEGORIES_PER_PLAYER = 64;

/**
 * Мост статистики Minecraft-сервера → сайт.
 *
 * POST /api/stats/from-server  — сервер шлёт актуальную статистику игроков:
 *
 *   {
 *     "players": [
 *       { "nickname": "Steve", "stats": { "deaths": 12, "play_time": 720000, ... } }
 *     ]
 *   }
 *
 * Ключи категорий — из src/lib/stats.ts (deaths, mob_kills, player_kills,
 * blocks_mined, items_crafted, walk_one_cm, damage_dealt, damage_taken, jumps,
 * play_time). `play_time` — в тиках (20 тиков = 1 секунда), walk_one_cm — в
 * сантиметрах, остальное — сырые числа ванильной статистики. Неизвестные
 * категории игнорируются, чтобы мод мог слать больше, чем сайт показывает.
 * Повторная отправка не уменьшает значение: берётся максимум из старого и
 * присланного (ванильные статы монотонны, а свежий вход после смены ника
 * может прислать нули раньше перенесённых данных).
 *
 * Требует заголовок `x-api-key`, совпадающий с CHAT_API_KEY в .env — тот же
 * ключ, что у чат-моста (см. config/chatbridge-common.toml на сервере).
 */
export async function POST(request: NextRequest) {
  if (!checkBridgeKey(request.headers.get("x-api-key"))) {
    return NextResponse.json({ error: "Неверный ключ API" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.players) || body.players.length === 0) {
    return NextResponse.json({ error: "Поле players обязано быть непустым массивом" }, { status: 400 });
  }
  if (body.players.length > MAX_PLAYERS) {
    return NextResponse.json({ error: `Слишком много игроков (макс. ${MAX_PLAYERS})` }, { status: 400 });
  }

  // Собираем строки (nickname, category, value), отбрасывая дубликаты
  // (в одном пакете берём первое вхождение) и неизвестные/битые категории.
  const rows: { nickname: string; category: string; value: number; updatedAt: Date }[] = [];
  const seen = new Set<string>();
  let rejected = 0;

  for (const player of body.players) {
    if (!player || typeof player !== "object") continue;
    const nickname =
      typeof player.nickname === "string" ? player.nickname.trim().slice(0, MAX_NICKNAME) : "";
    const stats = player.stats;
    if (!nickname || !stats || typeof stats !== "object") continue;

    for (const [category, rawValue] of Object.entries(stats)) {
      if (!STAT_CATEGORY_KEYS.has(category) && category !== PLAY_TIME_KEY) {
        rejected++;
        continue;
      }
      if (rows.length >= MAX_PLAYERS * MAX_CATEGORIES_PER_PLAYER) break;
      // Ванильные статы — целые неотрицательные числа.
      const value = typeof rawValue === "number" ? Math.floor(rawValue) : NaN;
      if (!Number.isFinite(value) || value < 0) {
        rejected++;
        continue;
      }
      const key = `${nickname}\u0000${category}`;
      if (seen.has(key)) continue; // дубликат в одном пакете — берём первое вхождение
      seen.add(key);

      rows.push({
        nickname,
        category,
        value: Math.min(value, Number.MAX_SAFE_INTEGER),
        updatedAt: new Date(),
      });
    }
  }

  if (rows.length === 0) {
    return NextResponse.json({ rejected }, { status: 400 });
  }

  try {
    await db
      .insert(playerStats)
      .values(rows)
      .onConflictDoUpdate({
        target: [playerStats.nickname, playerStats.category],
        set: {
          // Берём максимум: ванильные статы монотонны, а при переносе прогресса
          // при смене ника сервер может прислать свежие (нулевые) значения
          // раньше перенесённых — тогда они перезапишут настоящие.
          value: sql`max(${playerStats.value}, excluded.value)`,
          updatedAt: sql`excluded.updated_at`,
        },
      })
      .run();
  } catch (error) {
    console.error("Stats bridge error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }

  return NextResponse.json({ saved: rows.length, rejected });
}