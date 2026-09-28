import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { pendingInventoryRestores } from "@/lib/db/schema";
import { checkBridgeKey } from "@/lib/bridge";
import { eq } from "drizzle-orm";

/**
 * Мост отката: мод AlopetsiyaInventory спрашивает, есть ли для игрока
 * запланированный откат, при следующем входе.
 * GET /api/inventory/pending-restore?nickname=xxx — требует x-api-key.
 * Ответ: { pending: false } или { pending: true, snapshotId, data, nickname },
 * где data — полный снимок в формате моста (тот же, что шлёт /from-server).
 */
export async function GET(request: NextRequest) {
  if (!checkBridgeKey(request.headers.get("x-api-key"))) {
    return NextResponse.json({ error: "Неверный ключ API" }, { status: 401 });
  }

  const nickname = request.nextUrl.searchParams.get("nickname")?.trim().toLowerCase() ?? "";
  if (!nickname) {
    return NextResponse.json({ error: "nickname обязателен" }, { status: 400 });
  }

  const pending = await db
    .select({
      id: pendingInventoryRestores.id,
      nickname: pendingInventoryRestores.nickname,
      snapshotId: pendingInventoryRestores.snapshotId,
      data: pendingInventoryRestores.data,
      createdAt: pendingInventoryRestores.createdAt,
    })
    .from(pendingInventoryRestores)
    .where(eq(pendingInventoryRestores.nickname, nickname))
    .get();

  if (!pending) {
    return NextResponse.json({ pending: false });
  }

  let data: unknown = null;
  try {
    data = JSON.parse(pending.data);
  } catch {
    // Если снимок повреждён — отдаём null, мод просто его не применит.
    return NextResponse.json({ pending: false });
  }

  return NextResponse.json({
    pending: true,
    snapshotId: pending.snapshotId,
    nickname: pending.nickname,
    createdAt: pending.createdAt,
    data,
  });
}

export const dynamic = "force-dynamic";