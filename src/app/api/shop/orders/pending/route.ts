import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { shopOrders } from "@/lib/db/schema";
import { checkBridgeKey } from "@/lib/bridge";

/**
 * GET /api/shop/orders/pending — очередь заказов для мода/плагина (x-api-key).
 * Мод забирает pending-заказы, выдаёт предмет/косметику и отмечает результат
 * через POST /api/shop/orders/result.
 */
export async function GET(request: NextRequest) {
  if (!checkBridgeKey(request.headers.get("x-api-key"))) {
    return NextResponse.json({ error: "Неверный ключ API" }, { status: 401 });
  }

  const rows = await db
    .select({
      id: shopOrders.id,
      nickname: shopOrders.nickname,
      title: shopOrders.productTitle,
      kind: shopOrders.kind,
      payload: shopOrders.payload,
      createdAt: shopOrders.createdAt,
    })
    .from(shopOrders)
    .where(eq(shopOrders.status, "pending"))
    .orderBy(asc(shopOrders.id))
    .all();

  return NextResponse.json({
    orders: rows.map((row) => {
      let payload: unknown = {};
      try {
        payload = JSON.parse(row.payload);
      } catch {
        payload = {};
      }
      return {
        id: row.id,
        nickname: row.nickname,
        title: row.title,
        kind: row.kind,
        payload,
        createdAt: row.createdAt.getTime(),
      };
    }),
  });
}
