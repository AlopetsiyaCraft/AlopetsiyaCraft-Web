import { NextResponse } from "next/server";
import { and, eq, isNull, lte, or, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { dailySpins, users } from "@/lib/db/schema";
import {
  DAILY_PRIZES,
  DAILY_SPIN_COOLDOWN_MS,
  pickDailyPrizeIndex,
} from "@/lib/dailyBonus";

/**
 * POST /api/daily-bonus/spin
 * Крутит колесо ежедневного бонуса: выбирает приз на сервере (клиент не может
 * подменить результат), начисляет валюту и возвращает индекс сектора, чтобы
 * колесо остановилось именно на нём.
 *
 * Кулдаун 24 часа. Проверка и начисление — одним условным UPDATE: два
 * параллельных запроса не смогут выдать бонус дважды.
 */
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }
    const userId = parseInt(session.user.id, 10);

    const me = await db
      .select({ id: users.id, dailyBonusAt: users.dailyBonusAt })
      .from(users)
      .where(eq(users.id, userId))
      .get();
    if (!me) {
      return NextResponse.json({ error: "Аккаунт не найден" }, { status: 404 });
    }

    const now = new Date();
    const cutoff = new Date(now.getTime() - DAILY_SPIN_COOLDOWN_MS);

    // Криптослучайность: призы с весами, без Math.random.
    const random = new Uint32Array(1);
    crypto.getRandomValues(random);
    const index = pickDailyPrizeIndex(() => random[0] / 2 ** 32);
    const prize = DAILY_PRIZES[index];

    const claim = await db
      .update(users)
      .set({
        ...(prize.kind === "bld"
          ? { bld: sql`bld + ${prize.amount}` }
          : { chips: sql`chips + ${prize.amount}` }),
        dailyBonusAt: now,
      })
      .where(
        and(
          eq(users.id, userId),
          or(isNull(users.dailyBonusAt), lte(users.dailyBonusAt, cutoff))
        )
      )
      .run();

    if (claim.rowsAffected === 0) {
      const current = await db
        .select({ dailyBonusAt: users.dailyBonusAt })
        .from(users)
        .where(eq(users.id, userId))
        .get();
      const nextSpinAt = current?.dailyBonusAt
        ? current.dailyBonusAt.getTime() + DAILY_SPIN_COOLDOWN_MS
        : null;
      return NextResponse.json(
        { error: "Бонус уже получен — возвращайся после следующей попытки", nextSpinAt },
        { status: 429 }
      );
    }

    await db
      .insert(dailySpins)
      .values({ userId, prizeIndex: index, kind: prize.kind, amount: prize.amount })
      .run();

    const updated = await db
      .select({ bld: users.bld, chips: users.chips })
      .from(users)
      .where(eq(users.id, userId))
      .get();

    return NextResponse.json({
      index,
      kind: prize.kind,
      amount: prize.amount,
      bld: updated?.bld ?? 0,
      chips: updated?.chips ?? 0,
      nextSpinAt: now.getTime() + DAILY_SPIN_COOLDOWN_MS,
    });
  } catch (error) {
    console.error("Daily bonus spin error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
