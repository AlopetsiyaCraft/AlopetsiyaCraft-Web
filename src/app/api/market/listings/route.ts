import { NextRequest, NextResponse } from "next/server";
import { and, asc, desc, eq, gte } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { marketListings, marketOrders, users } from "@/lib/db/schema";
import type { ContainerKey } from "@/lib/inventory";
import {
  completeSale,
  marketItemKey,
  resolveItemMeta,
  returnInventoryItem,
  takeInventoryItem,
} from "@/lib/market";

const CONTAINERS = ["main", "armor", "offhand", "enderChest"] as const;

/**
 * POST /api/market/listings { container, slot, priceBld }
 * Выставляет один предмет из снимка инвентаря. Если есть подходящая заявка
 * на покупку — сделка проходит сразу.
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
  const container = body?.container as ContainerKey;
  const slot = Number(body?.slot);
  const priceBld = Number(body?.priceBld);

  if (!CONTAINERS.includes(container)) {
    return NextResponse.json({ error: "Некорректный контейнер" }, { status: 400 });
  }
  if (!Number.isInteger(slot) || slot < 0 || slot > 80) {
    return NextResponse.json({ error: "Некорректный слот" }, { status: 400 });
  }
  if (!Number.isInteger(priceBld) || priceBld < 1 || priceBld > 1_000_000) {
    return NextResponse.json({ error: "Цена должна быть от 1 до 1 000 000 BLD" }, { status: 400 });
  }

  const me = await db
    .select({ id: users.id, nickname: users.nickname })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  if (!me) {
    return NextResponse.json({ error: "Аккаунт не найден" }, { status: 404 });
  }

  const taken = await takeInventoryItem(me.nickname, container, slot);
  if ("error" in taken) {
    return NextResponse.json({ error: taken.error }, { status: 400 });
  }

  const { stack } = taken;
  const { title, icon } = await resolveItemMeta(stack.id, stack.name);
  const itemKey = marketItemKey(stack.id);

  let listingId: number | null = null;
  try {
    const inserted = await db
      .insert(marketListings)
      .values({
        sellerId: userId,
        sellerNickname: me.nickname,
        itemKey,
        title,
        material: stack.id,
        icon,
        itemData: JSON.stringify(stack),
        priceBld,
        status: "active",
      })
      .run();
    listingId = Number(inserted.lastInsertRowid);
  } catch (error) {
    await returnInventoryItem(me.nickname, stack);
    console.error("Market listing insert error:", error);
    return NextResponse.json({ error: "Не удалось выставить лот" }, { status: 500 });
  }

  // Заявки на покупку: самая дорогая подходящая исполняется сразу.
  const candidates = await db
    .select()
    .from(marketOrders)
    .where(
      and(
        eq(marketOrders.itemKey, itemKey),
        eq(marketOrders.status, "active"),
        gte(marketOrders.priceBld, priceBld)
      )
    )
    .orderBy(desc(marketOrders.priceBld), asc(marketOrders.createdAt))
    .limit(5)
    .all();

  let soldTo: string | null = null;
  for (const order of candidates) {
    if (order.userId === userId) continue;
    const result = await completeSale({
      listing: {
        id: listingId,
        sellerId: userId,
        sellerNickname: me.nickname,
        itemKey,
        title,
        material: stack.id,
        icon,
        itemData: JSON.stringify(stack),
        priceBld,
      },
      buyer: { id: order.userId, nickname: order.nickname },
      payment: "reserved",
      reservedBld: order.priceBld,
    });
    if (result.ok) {
      await db
        .update(marketOrders)
        .set({ status: "filled", filledAt: new Date() })
        .where(eq(marketOrders.id, order.id))
        .run();
      soldTo = order.nickname;
      break;
    }
  }

  if (soldTo) {
    return NextResponse.json({
      message: `Лот сразу купил ${soldTo}`,
      listingId,
      soldTo,
    });
  }

  return NextResponse.json({
    message: "Лот выставлен",
    listingId,
    soldTo: null,
  });
}
