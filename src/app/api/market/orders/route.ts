import { NextRequest, NextResponse } from "next/server";
import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  marketListings,
  marketOrders,
  marketSales,
  users,
  walletLedger,
} from "@/lib/db/schema";
import { completeSale, marketItemKey, resolveItemMeta } from "@/lib/market";

/**
 * POST /api/market/orders { itemKey, priceBld }
 * Создаёт заявку на покупку и сразу резервирует BLD. Если есть подходящий
 * лот — сделка проходит немедленно.
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
  const rawKey = typeof body?.itemKey === "string" ? body.itemKey.trim() : "";
  const priceBld = Number(body?.priceBld);
  if (!/^[a-zA-Z0-9_:.-]{3,80}$/.test(rawKey)) {
    return NextResponse.json({ error: "Некорректный предмет" }, { status: 400 });
  }
  if (!Number.isInteger(priceBld) || priceBld < 1 || priceBld > 1_000_000) {
    return NextResponse.json({ error: "Цена должна быть от 1 до 1 000 000 BLD" }, { status: 400 });
  }

  const me = await db
    .select({ id: users.id, nickname: users.nickname, bld: users.bld })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  if (!me) {
    return NextResponse.json({ error: "Аккаунт не найден" }, { status: 404 });
  }
  if ((me.bld ?? 0) < priceBld) {
    return NextResponse.json(
      { error: `Не хватает BLD: нужно ${priceBld}` },
      { status: 400 }
    );
  }

  const itemKey = marketItemKey(rawKey);
  const latestListing = await db
    .select({ title: marketListings.title, icon: marketListings.icon, material: marketListings.material })
    .from(marketListings)
    .where(eq(marketListings.itemKey, itemKey))
    .orderBy(desc(marketListings.createdAt))
    .limit(1)
    .get();
  const latestSale = latestListing
    ? null
    : await db
        .select({ title: marketSales.title, icon: marketSales.icon, material: marketSales.material })
        .from(marketSales)
        .where(eq(marketSales.itemKey, itemKey))
        .orderBy(desc(marketSales.createdAt))
        .limit(1)
        .get();
  const known = latestListing ?? latestSale;
  const meta = known
    ? { title: known.title, icon: known.icon, material: known.material }
    : { ...(await resolveItemMeta(itemKey, itemKey)), material: itemKey };

  // Резервируем BLD условным списанием.
  const charged = await db
    .update(users)
    .set({ bld: sql`bld - ${priceBld}` })
    .where(and(eq(users.id, userId), gte(users.bld, priceBld)))
    .run();
  if (charged.rowsAffected === 0) {
    return NextResponse.json({ error: "Недостаточно BLD" }, { status: 400 });
  }

  const inserted = await db
    .insert(marketOrders)
    .values({
      userId,
      nickname: me.nickname,
      itemKey,
      title: meta.title,
      material: meta.material,
      icon: meta.icon,
      priceBld,
      status: "active",
    })
    .run();
  const orderId = Number(inserted.lastInsertRowid);

  const afterReserve = await db
    .select({ bld: users.bld })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  await db
    .insert(walletLedger)
    .values({
      userId,
      currency: "bld",
      amount: -priceBld,
      balanceAfter: afterReserve?.bld ?? 0,
      reason: `Маркет: заявка на ${meta.title}`,
      refType: "market_order",
      refId: orderId,
    })
    .run();

  // Пытаемся сразу купить самый дешёвый подходящий лот.
  const candidates = await db
    .select()
    .from(marketListings)
    .where(
      and(
        eq(marketListings.itemKey, itemKey),
        eq(marketListings.status, "active"),
        lte(marketListings.priceBld, priceBld)
      )
    )
    .orderBy(asc(marketListings.priceBld), asc(marketListings.createdAt))
    .limit(5)
    .all();

  for (const listing of candidates) {
    if (listing.sellerId === userId) continue;
    if (listing.priceBld > priceBld) continue;
    const result = await completeSale({
      listing,
      buyer: { id: userId, nickname: me.nickname },
      payment: "reserved",
      reservedBld: priceBld,
    });
    if (result.ok) {
      await db
        .update(marketOrders)
        .set({ status: "filled", filledAt: new Date() })
        .where(eq(marketOrders.id, orderId))
        .run();
      const balance = await db
        .select({ bld: users.bld })
        .from(users)
        .where(eq(users.id, userId))
        .get();
      return NextResponse.json({
        message: "Заявка исполнена сразу",
        status: "filled",
        orderId,
        listingId: listing.id,
        bld: balance?.bld ?? 0,
        refundBld: result.refundBld ?? 0,
      });
    }
  }

  return NextResponse.json({
    message: "Заявка создана — BLD зарезервированы",
    status: "active",
    orderId,
    bld: afterReserve?.bld ?? 0,
  });
}
