import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdminUser } from "@/lib/admin";

/**
 * Список игроков, у которых есть снимки инвентаря (для селектора админа).
 * GET /api/inventory/admin/players — только админ.
 */
export async function GET() {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  const result = await db.$client.execute({
    sql: "SELECT nickname, display_nickname, MAX(captured_at) AS last_captured FROM inventory_snapshots GROUP BY nickname ORDER BY last_captured DESC",
  });

  const players = (result.rows as unknown as {
    nickname: string;
    display_nickname: string;
    last_captured: number;
  }[])
    .map((r) => ({
      nickname: r.nickname,
      displayNickname: r.display_nickname || r.nickname,
      lastCaptured: r.last_captured,
    }))
    .sort((a, b) => b.lastCaptured - a.lastCaptured);

  return NextResponse.json({ players });
}

export const dynamic = "force-dynamic";