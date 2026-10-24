import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { marketListings, users } from "@/lib/db/schema";
import { completeSale } from "@/lib/market";

/** POST /api/market/listings/[id]/buy — купить лот по указанной цене. */
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

  const [listing, buyer] = await Promise.all([
    db.select().from(marketListings).where(eq(marketListings.id, listingId)).get(),
    db
      .select({ id: users.id, nickname: users.nickname, bld: users.bld })
      .from(users)
      .where(eq(users.id, userId))
      .get(),
  ]);

  if (!listing || listing.status !== "active") {
    return NextResponse.json({ error: "Лот больше не продаётся" }, { status: 404 });
  }
  if (!buyer) {
    return NextResponse.json({ error: "Аккаунт не найден" }, { status: 404 });
  }
  if (buyer.id === listing.sellerId) {
    return NextResponse.json({ error: "Нельзя купить свой лот" }, { status: 400 });
  }

  const result = await completeSale({
    listing,
    buyer,
    payment: "charge",
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Не удалось купить" }, { status: 400 });
  }

  const updated = await db
    .select({ bld: users.bld })
    .from(users)
    .where(eq(users.id, userId))
    .get();

  return NextResponse.json({
    message: "Куплено",
    bld: updated?.bld ?? 0,
    feeBld: result.feeBld,
    sellerGain: result.sellerGain,
  });
}
