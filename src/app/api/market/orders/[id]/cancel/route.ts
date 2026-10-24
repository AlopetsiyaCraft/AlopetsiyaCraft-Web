import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { marketOrders, users, walletLedger } from "@/lib/db/schema";

/** POST /api/market/orders/[id]/cancel — снять заявку и вернуть резерв BLD. */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ error: "Некорректная сессия" }, { status: 401 });
  }

  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return NextResponse.json({ error: "Некорректная заявка" }, { status: 400 });
  }

  const order = await db.select().from(marketOrders).where(eq(marketOrders.id, orderId)).get();
  if (!order) {
    return NextResponse.json({ error: "Заявка не найдена" }, { status: 404 });
  }
  if (order.userId !== userId) {
    return NextResponse.json({ error: "Это не ваша заявка" }, { status: 403 });
  }
  if (order.status !== "active") {
    return NextResponse.json({ error: "Заявка уже не активна" }, { status: 409 });
  }

  const cancelled = await db
    .update(marketOrders)
    .set({ status: "cancelled" })
    .where(and(eq(marketOrders.id, orderId), eq(marketOrders.status, "active")))
    .run();
  if (cancelled.rowsAffected === 0) {
    return NextResponse.json({ error: "Заявку уже исполнили" }, { status: 409 });
  }

  await db
    .update(users)
    .set({ bld: sql`bld + ${order.priceBld}` })
    .where(eq(users.id, userId))
    .run();
  const balance = await db
    .select({ bld: users.bld })
    .from(users)
    .where(eq(users.id, userId))
    .get();

  await db
    .insert(walletLedger)
    .values({
      userId,
      currency: "bld",
      amount: order.priceBld,
      balanceAfter: balance?.bld ?? 0,
      reason: `Маркет: отмена заявки на ${order.title}`,
      refType: "market_order",
      refId: orderId,
    })
    .run();

  return NextResponse.json({ message: "Заявка отменена, BLD возвращены", bld: balance?.bld ?? 0 });
}
