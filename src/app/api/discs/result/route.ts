import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { discRequests } from "@/lib/db/schema";
import { checkBridgeKey } from "@/lib/bridge";

/**
 * POST /api/discs/result — мод сообщает итог обработки заявки (x-api-key).
 * body: { requestId: number, ok: boolean, error?: string }
 * Переводит заявку pending → done | failed.
 */
export async function POST(request: NextRequest) {
  if (!checkBridgeKey(request.headers.get("x-api-key"))) {
    return NextResponse.json({ error: "Неверный ключ API" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const requestId = typeof body?.requestId === "number" ? body.requestId : NaN;
  const ok = body?.ok === true;
  const error =
    typeof body?.error === "string" ? body.error.slice(0, 300) : null;

  if (!Number.isFinite(requestId)) {
    return NextResponse.json({ error: "requestId обязателен" }, { status: 400 });
  }

  // Обновляем только ещё pending-заявку (не перезаписываем уже завершённую).
  const result = await db
    .update(discRequests)
    .set({
      status: ok ? "done" : "failed",
      error: ok ? null : error,
      completedAt: new Date(),
    })
    .where(and(eq(discRequests.id, requestId), eq(discRequests.status, "pending")))
    .run();

  if (result.rowsAffected === 0) {
    return NextResponse.json({ message: "Заявка уже обработана" }, { status: 200 });
  }

  return NextResponse.json({ message: "OK" });
}