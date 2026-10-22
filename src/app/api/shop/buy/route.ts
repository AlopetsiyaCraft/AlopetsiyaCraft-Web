import { NextRequest, NextResponse } from "next/server";
import { and, count, eq, gte, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { shopOrders, shopProducts, users, walletLedger } from "@/lib/db/schema";

/**
 * POST /api/shop/buy { productId }
 *
 * Покупка товара за BLD. Списание условное (bld >= price), поэтому два
 * параллельных запроса не могут увести баланс в минус. Заказ создаётся
 * в статусе pending — его заберёт мод/плагин и отметит delivered/failed.
 * Если создание заказа падает после списания, деньги возвращаются.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ error: "Некорректная сессия" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const productId = Number(body?.productId);
  if (!Number.isInteger(productId) || productId <= 0) {
    return NextResponse.json({ error: "productId обязателен" }, { status: 400 });
  }

  const product = await db
    .select()
    .from(shopProducts)
    .where(and(eq(shopProducts.id, productId), eq(shopProducts.isActive, true)))
    .get();
  if (!product) {
    return NextResponse.json({ error: "Товар не найден или снят с продажи" }, { status: 404 });
  }

  const me = await db
    .select({ id: users.id, nickname: users.nickname, bld: users.bld })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  if (!me) {
    return NextResponse.json({ error: "Аккаунт не найден" }, { status: 404 });
  }

  if (product.maxPerUser != null && product.maxPerUser > 0) {
    const bought = await db
      .select({ total: count() })
      .from(shopOrders)
      .where(
        and(
          eq(shopOrders.userId, userId),
          eq(shopOrders.productId, product.id),
          sql`${shopOrders.status} IN ('pending', 'delivered')`
        )
      )
      .get();
    if ((bought?.total ?? 0) >= product.maxPerUser) {
      return NextResponse.json(
        { error: "Лимит покупок этого товара исчерпан" },
        { status: 409 }
      );
    }
  }

  if ((me.bld ?? 0) < product.priceBld) {
    return NextResponse.json(
      { error: `Не хватает BLD: нужно ${product.priceBld}` },
      { status: 400 }
    );
  }

  // Условное списание: между проверкой баланса и UPDATE могла пройти другая
  // покупка, поэтому проверяем bld >= price прямо в WHERE.
  const charge = await db
    .update(users)
    .set({ bld: sql`bld - ${product.priceBld}` })
    .where(and(eq(users.id, userId), gte(users.bld, product.priceBld)))
    .run();

  if (charge.rowsAffected === 0) {
    return NextResponse.json({ error: "Недостаточно BLD" }, { status: 400 });
  }

  let orderId: number | null = null;
  try {
    const inserted = await db
      .insert(shopOrders)
      .values({
        userId,
        productId: product.id,
        nickname: me.nickname,
        productTitle: product.title,
        kind: product.kind,
        priceBld: product.priceBld,
        payload: product.payload,
      })
      .run();
    orderId = Number(inserted.lastInsertRowid);

    const updated = await db
      .select({ bld: users.bld })
      .from(users)
      .where(eq(users.id, userId))
      .get();
    const balance = updated?.bld ?? 0;

    await db
      .insert(walletLedger)
      .values({
        userId,
        currency: "bld",
        amount: -product.priceBld,
        balanceAfter: balance,
        reason: `Покупка: ${product.title}`,
        refType: "shop_order",
        refId: orderId,
      })
      .run();

    return NextResponse.json({
      bld: balance,
      order: {
        id: orderId,
        title: product.title,
        kind: product.kind,
        priceBld: product.priceBld,
        status: "pending",
      },
    });
  } catch (error) {
    // Заказ не создался — возвращаем деньги, чтобы покупка не «сгорела».
    await db
      .update(users)
      .set({ bld: sql`bld + ${product.priceBld}` })
      .where(eq(users.id, userId))
      .run();
    console.error("Shop buy error:", error);
    return NextResponse.json({ error: "Не удалось создать заказ" }, { status: 500 });
  }
}
