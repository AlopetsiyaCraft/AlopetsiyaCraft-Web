import { eq } from "drizzle-orm";
import { db } from "./db";
import { users } from "./db/schema";

export interface Wallet {
  name: string;
  skinUrl: string | null;
  bld: number;
  chips: number;
}

/** Кошелёк пользователя (Болды + Фишки). */
export async function getWallet(userId: number): Promise<Wallet | null> {
  const row = await db
    .select({ name: users.nickname, skinUrl: users.skinUrl, bld: users.bld, chips: users.chips })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  if (!row) return null;
  return { name: row.name, skinUrl: row.skinUrl, bld: row.bld ?? 0, chips: row.chips ?? 0 };
}

/** Установить оба баланса сразу (атомарно для нашего случая). */
export async function setWallet(userId: number, bld: number, chips: number) {
  await db.update(users).set({ bld, chips }).where(eq(users.id, userId)).run();
}