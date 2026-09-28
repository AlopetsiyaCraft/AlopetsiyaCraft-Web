import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { inventorySnapshots } from "@/lib/db/schema";
import { getAdminUser } from "@/lib/admin";
import { parseInventoryData } from "@/lib/inventory";
import { desc, eq } from "drizzle-orm";

/**
 * История снимков инвентаря игрока (для админа).
 * GET /api/inventory/admin/history?nickname=xxx — только админ.
 * Возвращает последние 50 снимков: id, время, причина, пара статистик.
 */
export async function GET(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  const nickname = request.nextUrl.searchParams.get("nickname")?.trim().toLowerCase() ?? "";
  if (!nickname) {
    return NextResponse.json({ error: "nickname обязателен" }, { status: 400 });
  }

  const rows = await db
    .select({
      id: inventorySnapshots.id,
      nickname: inventorySnapshots.nickname,
      displayNickname: inventorySnapshots.displayNickname,
      data: inventorySnapshots.data,
      reason: inventorySnapshots.reason,
      capturedAt: inventorySnapshots.capturedAt,
    })
    .from(inventorySnapshots)
    .where(eq(inventorySnapshots.nickname, nickname))
    .orderBy(desc(inventorySnapshots.id))
    .limit(50);

  const snapshots = rows.map((row) => {
    const inv = parseInventoryData(row.data);
    let itemCount = 0;
    let totalCount = 0;
    if (inv) {
      for (const key of ["main", "armor", "offhand", "enderChest"] as const) {
        for (const stack of inv.containers[key] ?? []) {
          if (stack) {
            itemCount++;
            totalCount += stack.count;
          }
        }
      }
    }
    return {
      id: row.id,
      displayNickname: row.displayNickname || row.nickname,
      reason: row.reason,
      capturedAt: row.capturedAt,
      itemCount,
      totalCount,
      xpLevel: inv?.xpLevel ?? 0,
      health: inv?.health ?? 0,
      food: inv?.food ?? 0,
    };
  });

  return NextResponse.json({ nickname, snapshots });
}

export const dynamic = "force-dynamic";