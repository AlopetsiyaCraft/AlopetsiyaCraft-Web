import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { shopOrders, users, walletLedger } from "@/lib/db/schema";
import { checkBridgeKey } from "@/lib/bridge";
import { createNotification } from "@/lib/notifications";
import { notifyDiscordEvent, notifyDiscordUser } from "@/lib/discord";

/**
 * POST /api/shop/orders/result — мод сообщает итог выдачи (x-api-key).
 * body: { orderId: number, ok: boolean, error?: string }
 *
 * ok=true  → заказ delivered.
 * ok=false → заказ refunded, BLD возвращаются игроку (с записью в ledger).
 *
 * Повторный вызов для уже завершённого заказа безопасен: обновляем только
 * pending, иначе просто отвечаем, что заказ уже обработан.
 */
export async function POST(request: NextRequest) {
  if (!checkBridgeKey(request.headers.get("x-api-key"))) {
    return NextResponse.json({ error: "Неверный ключ API" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const orderId = Number(body?.orderId);
  const ok = body?.ok === true;
  const error = typeof body?.error === "string" ? body.error.slice(0, 300) : null;

  if (!Number.isInteger(orderId) || orderId <= 0) {
    return NextResponse.json({ error: "orderId обязателен" }, { status: 400 });
  }

  const order = await db
    .select({
      id: shopOrders.id,
      userId: shopOrders.userId,
      priceBld: shopOrders.priceBld,
      productTitle: shopOrders.productTitle,
    })
    .from(shopOrders)
    .where(eq(shopOrders.id, orderId))
    .get();
  if (!order) {
    return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });
  }

  const updated = await db
    .update(shopOrders)
    .set({
      status: ok ? "delivered" : "refunded",
      error: ok ? null : error ?? "Выдача не удалась",
      completedAt: new Date(),
    })
    .where(and(eq(shopOrders.id, orderId), eq(shopOrders.status, "pending")))
    .run();

  if (updated.rowsAffected === 0) {
    return NextResponse.json({ message: "Заказ уже обработан" });
  }

  if (!ok) {
    await db
      .update(users)
      .set({ bld: sql`bld + ${order.priceBld}` })
      .where(eq(users.id, order.userId))
      .run();

    const balanceRow = await db
      .select({ bld: users.bld })
      .from(users)
      .where(eq(users.id, order.userId))
      .get();

    await db
      .insert(walletLedger)
      .values({
        userId: order.userId,
        currency: "bld",
        amount: order.priceBld,
        balanceAfter: balanceRow?.bld ?? 0,
        reason: `Возврат: ${order.productTitle}`,
        refType: "shop_order",
        refId: order.id,
      })
      .run();
  }

  await createNotification({
    userId: order.userId,
    type: ok ? "shop_delivered" : "shop_refunded",
    title: ok
      ? `Заказ «${order.productTitle}» выдан`
      : `Возврат за заказ «${order.productTitle}»`,
    body: ok
      ? "Товар уже в игре — проверь инвентарь или косметику."
      : `${order.priceBld} BLD вернулись на баланс.`,
    link: ok ? "/shop" : "/wallet",
  });

  await notifyDiscordUser(
    order.userId,
    ok
      ? `📦 Заказ «${order.productTitle}» выдан в игре.`
      : `↩️ Заказ «${order.productTitle}» не выдан: ${order.priceBld} BLD вернулись на баланс.`
  );
  await notifyDiscordEvent({
    title: ok ? "Заказ выдан" : "Заказ возвращён",
    description: `${order.productTitle} · ${order.priceBld} BLD${ok ? "" : ` · ${error ?? "ошибка выдачи"}`}`,
    link: "/shop",
  });

  return NextResponse.json({ message: "OK" });
}
