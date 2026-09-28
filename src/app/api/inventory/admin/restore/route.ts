import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { inventorySnapshots, pendingInventoryRestores } from "@/lib/db/schema";
import { getAdminUser } from "@/lib/admin";
import { eq, sql } from "drizzle-orm";

/**
 * Запланировать отложенный откат инвентаря к точке истории.
 * POST /api/inventory/admin/restore { snapshotId } — только админ.
 * Применится модом при следующем входе игрока (pending на один ник,
 * новая команда заменяет старую).
 */
export async function POST(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  let body: { snapshotId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректное тело" }, { status: 400 });
  }
  const snapshotId = Number(body?.snapshotId);
  if (!Number.isInteger(snapshotId) || snapshotId <= 0) {
    return NextResponse.json({ error: "snapshotId обязателен" }, { status: 400 });
  }

  const snapshot = await db
    .select({
      id: inventorySnapshots.id,
      nickname: inventorySnapshots.nickname,
      displayNickname: inventorySnapshots.displayNickname,
      data: inventorySnapshots.data,
      capturedAt: inventorySnapshots.capturedAt,
    })
    .from(inventorySnapshots)
    .where(eq(inventorySnapshots.id, snapshotId))
    .get();

  if (!snapshot) {
    return NextResponse.json({ error: "Снимок не найден" }, { status: 404 });
  }

  await db
    .insert(pendingInventoryRestores)
    .values({
      nickname: snapshot.nickname,
      snapshotId: snapshot.id,
      data: snapshot.data,
      createdAt: Math.floor(Date.now()),
    })
    .onConflictDoUpdate({
      target: pendingInventoryRestores.nickname,
      set: {
        snapshotId: sql`excluded.snapshot_id`,
        data: sql`excluded.data`,
        createdAt: sql`excluded.created_at`,
      },
    })
    .run();

  const when = new Date(snapshot.capturedAt).toLocaleString("ru-RU");
  return NextResponse.json({
    ok: true,
    nickname: snapshot.nickname,
    displayNickname: snapshot.displayNickname || snapshot.nickname,
    snapshotId: snapshot.id,
    message: `Откат к точке ${when} запланирован — применится при следующем входе игрока`,
  });
}

export const dynamic = "force-dynamic";