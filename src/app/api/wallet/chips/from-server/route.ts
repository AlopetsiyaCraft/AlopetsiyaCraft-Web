import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { checkBridgeKey } from "@/lib/bridge";

const MAX_NICKNAME = 32;

/**
 * Мост фишек казино: игровой мод AlopetsiyaCraft списывает (amount < 0) или
 * начисляет (amount > 0, выигрыш) фишки игрока, когда тот играет за столом.
 *
 * POST /api/wallet/chips/from-server
 *   body: { nickname: "Steve", amount: -10 }
 *   → { ok: true, chips: 990 } | { ok: false, error, chips }
 *
 * Требует header `x-api-key` = CHAT_API_KEY (как остальные эндпоинты моста).
 * Ник ищется без учёта регистра.
 */
export async function POST(request: NextRequest) {
  if (!checkBridgeKey(request.headers.get("x-api-key"))) {
    return NextResponse.json({ error: "Неверный ключ API" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const nickname = typeof body?.nickname === "string" ? body.nickname.trim().slice(0, MAX_NICKNAME) : "";
  const amount = Number(body?.amount);

  if (!nickname) {
    return NextResponse.json({ error: "Поле nickname обязательно" }, { status: 400 });
  }
  if (!Number.isInteger(amount) || amount === 0) {
    return NextResponse.json({ error: "amount должен быть ненулевым целым числом" }, { status: 400 });
  }

  const target = await db
    .select({ id: users.id, chips: users.chips })
    .from(users)
    .where(sql`lower(${users.nickname}) = ${nickname.toLowerCase()}`)
    .get();
  if (!target) {
    return NextResponse.json({ error: `Игрок ${nickname} не найден` }, { status: 404 });
  }

  const current = target.chips ?? 0;
  const next = current + amount;
  if (next < 0) {
    // Нельзя уйти в минус: списание отклоняется, баланс в ответе.
    return NextResponse.json({ ok: false, error: "Недостаточно фишек", chips: current });
  }

  await db.update(users).set({ chips: next }).where(eq(users.id, target.id)).run();
  return NextResponse.json({ ok: true, chips: next });
}