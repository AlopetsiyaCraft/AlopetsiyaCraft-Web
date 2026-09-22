import { timingSafeEqual } from "crypto";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { seasons } from "@/lib/db/schema";

/** Ключ для внешних систем (мод Minecraft, будущий Discord-бот). Задаётся в .env: CHAT_API_KEY */
const BRIDGE_API_KEY = process.env.CHAT_API_KEY || "";

/** Постоянновременное сравнение ключа (защита от timing-атак). */
export function checkBridgeKey(provided: string | null): boolean {
  if (!BRIDGE_API_KEY || !provided) return false;
  const a = Buffer.from(BRIDGE_API_KEY);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Активный сезон для сообщений, у которых сезон не указан явно
 * (чат с сайта, сообщения моста с сервера). Если активного нет — самый свежий.
 */
export async function getActiveSeasonId(): Promise<number> {
  const active = await db
    .select({ id: seasons.id })
    .from(seasons)
    .where(eq(seasons.isActive, true))
    .limit(1)
    .get();
  if (active) return active.id;

  const latest = await db
    .select({ id: seasons.id })
    .from(seasons)
    .orderBy(desc(seasons.id))
    .limit(1)
    .get();
  return latest?.id ?? 4;
}