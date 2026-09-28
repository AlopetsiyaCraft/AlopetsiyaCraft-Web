import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { pendingInventoryRestores } from "@/lib/db/schema";
import { checkBridgeKey } from "@/lib/bridge";
import { eq } from "drizzle-orm";

/**
 * Мост отката: мод подтверждает, что откат применён — pending удаляется.
 * POST /api/inventory/pending-restore/apply { nickname } — требует x-api-key.
 */
export async function POST(request: NextRequest) {
  if (!checkBridgeKey(request.headers.get("x-api-key"))) {
    return NextResponse.json({ error: "Неверный ключ API" }, { status: 401 });
  }

  let body: { nickname?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректное тело" }, { status: 400 });
  }
  const nickname = String(body?.nickname ?? "").trim().toLowerCase();
  if (!nickname) {
    return NextResponse.json({ error: "nickname обязателен" }, { status: 400 });
  }

  await db
    .delete(pendingInventoryRestores)
    .where(eq(pendingInventoryRestores.nickname, nickname))
    .run();

  return NextResponse.json({ applied: true, nickname });
}

export const dynamic = "force-dynamic";