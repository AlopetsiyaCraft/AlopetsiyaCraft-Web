import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { getAdminUser } from "@/lib/admin";
import { db } from "@/lib/db";
import { shopOrders, users, walletLedger } from "@/lib/db/schema";

/**
 * POST /api/admin/shop/orders { orderId, action: "deliver" | "refund" }
 * Ручное завершение заказа из админки. refund возвращает BLD и пишет ledger.
 * Обновляем только pending, чтобы повторное нажатие не выдало/не вернуло дважды.
 */
export async function POST(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Нет прав" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const orderId = Number(body?.orderId);
  const action = body?.action;
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return NextResponse.json({ error: "orderId обязателен" }, { status: 400 });
  }
  if (action !== "deliver" && action !== "refund") {
    return NextResponse.json({ error: "action: deliver или refund" }, { status: 400 });
  }

  const order = await db
    .select({
      id: shopOrders.id,
      userId: shopOrders.userId,
      priceBld: shopOrders.priceBld,
      productTitle: shopOrders.productTitle,
      status: shopOrders.status,
    })
    .from(shopOrders)
    .where(eq(shopOrders.id, orderId))
    .get();
  if (!order) {
    return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });
  }
  if (order.status !== "pending") {
    return NextResponse.json(
      { error: "Заказ уже завершён", status: order.status },
      { status: 409 }
    );
  }

  const updated = await db
    .update(shopOrders)
    .set({
      status: action === "deliver" ? "delivered" : "refunded",
      error: action === "refund" ? "Возврат администратором" : null,
      completedAt: new Date(),
    })
    .where(and(eq(shopOrders.id, orderId), eq(shopOrders.status, "pending")))
    .run();

  if (updated.rowsAffected === 0) {
    return NextResponse.json({ error: "Заказ уже обработан" }, { status: 409 });
  }

  if (action === "refund") {
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

  return NextResponse.json({ message: "OK", status: action === "deliver" ? "delivered" : "refunded" });
}
