import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getAdminUser } from "@/lib/admin";
import { logAdminAction } from "@/lib/adminAudit";
import { db } from "@/lib/db";
import { users, walletLedger } from "@/lib/db/schema";
import { announceCurrencyChange } from "@/lib/chatAnnounce";
import { createNotification } from "@/lib/notifications";

/**
 * POST /api/admin/bld { nickname, amount }
 * Начислить (amount > 0) или списать (amount < 0) Болды (BLD) игроку.
 * Баланс не уходит ниже 0. Доступно только администратору.
 *
 * О выдаче пишем в чат: мод chatbridge забирает сообщение с сайта и выводит
 * его в игре, так что игроки видят пополнение.
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: "Нет прав" }, { status: 403 });
    }

    const body = await request.json();
    const nickname = typeof body?.nickname === "string" ? body.nickname.trim() : "";
    const amount = Number(body?.amount);

    if (!nickname) {
      return NextResponse.json({ error: "nickname обязателен" }, { status: 400 });
    }
    if (!Number.isInteger(amount)) {
      return NextResponse.json({ error: "amount должен быть целым числом" }, { status: 400 });
    }

    const target = await db
      .select({ id: users.id, nickname: users.nickname, bld: users.bld })
      .from(users)
      .where(eq(users.nickname, nickname))
      .get();
    if (!target) {
      return NextResponse.json({ error: `Игрок ${nickname} не найден` }, { status: 404 });
    }

    const current = target.bld ?? 0;
    const next = Math.max(0, current + amount);
    await db.update(users).set({ bld: next }).where(eq(users.id, target.id)).run();

    if (next !== current) {
      await db
        .insert(walletLedger)
        .values({
          userId: target.id,
          currency: "bld",
          amount: next - current,
          balanceAfter: next,
          reason: `Админ: ${admin.nickname}`,
          refType: "admin",
        })
        .run();

      await createNotification({
        userId: target.id,
        type: "currency",
        title:
          next > current
            ? `Начислено ${next - current} BLD`
            : `Списано ${current - next} BLD`,
        body: `Текущий баланс: ${next} BLD.`,
        link: "/wallet",
      });
    }

    await announceCurrencyChange({
      currency: "BLD",
      amount: next - current,
      balance: next,
      targetNickname: target.nickname,
      adminNickname: admin.nickname,
    });

    await logAdminAction({
      admin,
      action: "currency.bld",
      targetType: "user",
      targetId: target.id,
      details: `${target.nickname}: ${next - current >= 0 ? "+" : ""}${next - current} BLD → ${next}`,
    });

    return NextResponse.json({ nickname, amount, balance: next });
  } catch (error) {
    console.error("Admin BLD error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}