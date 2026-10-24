import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { marketListings } from "@/lib/db/schema";
import type { InventoryStack } from "@/lib/inventory";
import { returnInventoryItem } from "@/lib/market";

/** POST /api/market/listings/[id]/cancel — снять лот и вернуть предмет. */
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
  const listingId = Number(id);
  if (!Number.isInteger(listingId) || listingId <= 0) {
    return NextResponse.json({ error: "Некорректный лот" }, { status: 400 });
  }

  const listing = await db
    .select()
    .from(marketListings)
    .where(eq(marketListings.id, listingId))
    .get();
  if (!listing) {
    return NextResponse.json({ error: "Лот не найден" }, { status: 404 });
  }
  if (listing.sellerId !== userId) {
    return NextResponse.json({ error: "Это не ваш лот" }, { status: 403 });
  }
  if (listing.status !== "active") {
    return NextResponse.json({ error: "Лот уже не активен" }, { status: 409 });
  }

  let stack: InventoryStack | null = null;
  try {
    stack = JSON.parse(listing.itemData) as InventoryStack;
  } catch {
    stack = null;
  }
  if (!stack) {
    return NextResponse.json({ error: "Повреждённые данные лота" }, { status: 500 });
  }

  const cancelled = await db
    .update(marketListings)
    .set({ status: "cancelled" })
    .where(and(eq(marketListings.id, listingId), eq(marketListings.status, "active")))
    .run();
  if (cancelled.rowsAffected === 0) {
    return NextResponse.json({ error: "Лот уже продан" }, { status: 409 });
  }

  const returned = await returnInventoryItem(listing.sellerNickname, stack);
  if (!returned) {
    await db
      .update(marketListings)
      .set({ status: "active" })
      .where(eq(marketListings.id, listingId))
      .run();
    return NextResponse.json(
      { error: "В инвентаре нет места — освободи слот и попробуй снова" },
      { status: 409 }
    );
  }

  return NextResponse.json({ message: "Лот снят, предмет возвращён в инвентарь" });
}
