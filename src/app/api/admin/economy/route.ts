import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications, users, walletLedger } from "@/lib/db/schema";
import { getAdminUser } from "@/lib/admin";
import { logAdminAction } from "@/lib/adminAudit";

/**
 * POST /api/admin/economy { currency, amount, audience, nickname?, reason? }
 * Массовое начисление или списание BLD/фишек. audience: all | users | admins.
 * Баланс не уходит ниже нуля.
 */
export async function POST(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Нет прав" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const currency = body?.currency === "chips" ? "chips" : body?.currency === "bld" ? "bld" : null;
  const amount = Number(body?.amount);
  const audience = body?.audience === "users" || body?.audience === "admins" ? body.audience : "all";
  const reason =
    typeof body?.reason === "string" && body.reason.trim()
      ? body.reason.trim().slice(0, 200)
      : "Массовое начисление";

  if (!currency) {
    return NextResponse.json({ error: "currency: bld или chips" }, { status: 400 });
  }
  if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 1_000_000) {
    return NextResponse.json(
      { error: "amount: целое число от -1 000 000 до 1 000 000, не 0" },
      { status: 400 }
    );
  }

  const role = audience === "all" ? null : audience === "admins" ? "admin" : "user";
  const targets = role
    ? await db
        .select({ id: users.id, nickname: users.nickname, bld: users.bld, chips: users.chips })
        .from(users)
        .where(eq(users.role, role))
        .all()
    : await db
        .select({ id: users.id, nickname: users.nickname, bld: users.bld, chips: users.chips })
        .from(users)
        .all();

  if (targets.length === 0) {
    return NextResponse.json({ error: "Нет получателей" }, { status: 404 });
  }

  let affected = 0;
  let totalChange = 0;
  const notificationsToSend: Array<typeof notifications.$inferInsert> = [];
  const ledgerRows: Array<typeof walletLedger.$inferInsert> = [];

  for (const target of targets) {
    const current = currency === "bld" ? target.bld : target.chips;
    const next = Math.max(0, current + amount);
    const delta = next - current;
    if (delta === 0) continue;

    await db
      .update(users)
      .set(currency === "bld" ? { bld: next } : { chips: next })
      .where(eq(users.id, target.id))
      .run();

    affected += 1;
    totalChange += delta;
    ledgerRows.push({
      userId: target.id,
      currency,
      amount: delta,
      balanceAfter: next,
      reason: `Админ: ${reason}`,
      refType: "admin",
    });
    notificationsToSend.push({
      userId: target.id,
      type: "currency",
      title: `${delta > 0 ? "Начислено" : "Списано"} ${Math.abs(delta)} ${
        currency === "bld" ? "BLD" : "фишек"
      }`,
      body: `Текущий баланс: ${next}.`,
      link: "/wallet",
    });
  }

  if (ledgerRows.length > 0) {
    await db.insert(walletLedger).values(ledgerRows).run();
  }
  if (notificationsToSend.length > 0) {
    await db.insert(notifications).values(notificationsToSend).run();
  }

  await logAdminAction({
    admin,
    action: "economy.grant",
    targetType: audience,
    targetId: null,
    details: `${currency}: ${amount > 0 ? "+" : ""}${amount} · ${affected} игроков · ${reason}`,
  });

  return NextResponse.json({
    message: "Готово",
    affected,
    totalChange,
  });
}
