import { NextRequest, NextResponse } from "next/server";
import { and, count, eq, gte, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  shopOrders,
  shopProducts,
  userFrames,
  users,
  walletLedger,
} from "@/lib/db/schema";
import { PROFILE_FRAMES } from "@/lib/profileCustomization";

function parsePayload(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/** Приз внутри кейса: вес и то, что выдаём. */
interface CasePrize {
  label: string;
  weight: number;
  kind: string;
  amount?: number;
  frame?: string;
  payload?: Record<string, unknown>;
  /** Во что превращается повторная рамка/фон. */
  duplicateBld?: number;
}

const PRIZE_KINDS = new Set([
  "bld",
  "chips",
  "frame",
  "profile_bg",
  "item",
  "pet",
  "title",
  "nick_effect",
  "cape",
  "nothing",
]);

function parsePrizes(payload: Record<string, unknown>): CasePrize[] {
  const raw = Array.isArray(payload.prizes) ? payload.prizes : [];
  const prizes: CasePrize[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const prize = item as Record<string, unknown>;
    const kind = typeof prize.kind === "string" ? prize.kind : "";
    if (!PRIZE_KINDS.has(kind)) continue;
    const weight = Math.max(0, Number(prize.weight) || 0);
    if (weight <= 0) continue;
    const label =
      typeof prize.label === "string" && prize.label.trim()
        ? prize.label.trim().slice(0, 80)
        : kind;
    const parsed: CasePrize = { label, weight, kind };
    if (prize.amount != null) {
      parsed.amount = Math.max(1, Math.floor(Number(prize.amount) || 1));
    }
    if (typeof prize.frame === "string") parsed.frame = prize.frame;
    if (
      prize.payload &&
      typeof prize.payload === "object" &&
      !Array.isArray(prize.payload)
    ) {
      parsed.payload = prize.payload as Record<string, unknown>;
    }
    if (prize.duplicateBld != null) {
      parsed.duplicateBld = Math.max(0, Math.floor(Number(prize.duplicateBld) || 0));
    }
    prizes.push(parsed);
  }
  return prizes;
}

/** Взвешенный выбор приза криптографическим рандомом. */
function pickPrize(prizes: CasePrize[]): CasePrize | null {
  const total = prizes.reduce((sum, prize) => sum + prize.weight, 0);
  if (total <= 0) return null;
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  let roll = (buffer[0] / 0x100000000) * total;
  for (const prize of prizes) {
    roll -= prize.weight;
    if (roll < 0) return prize;
  }
  return prizes[prizes.length - 1] ?? null;
}

/**
 * POST /api/shop/buy { productId }
 *
 * Покупка товара за BLD. Списание условное (bld >= price), поэтому два
 * параллельных запроса не могут увести баланс в минус.
 *
 * Мгновенно выдаются рамки, фон, кейсы и смены ника. Остальные товары
 * создают заказ pending — его забирает мод/плагин.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ error: "Некорректная сессия" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const productId = Number(body?.productId);
  if (!Number.isInteger(productId) || productId <= 0) {
    return NextResponse.json({ error: "productId обязателен" }, { status: 400 });
  }

  const product = await db
    .select()
    .from(shopProducts)
    .where(and(eq(shopProducts.id, productId), eq(shopProducts.isActive, true)))
    .get();
  if (!product) {
    return NextResponse.json({ error: "Товар не найден или снят с продажи" }, { status: 404 });
  }

  const me = await db
    .select({
      id: users.id,
      nickname: users.nickname,
      bld: users.bld,
      profileBgUnlocked: users.profileBgUnlocked,
    })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  if (!me) {
    return NextResponse.json({ error: "Аккаунт не найден" }, { status: 404 });
  }

  const payload = parsePayload(product.payload);
  const frameId = typeof payload.frame === "string" ? payload.frame : null;
  const instant = ["frame", "profile_bg", "case", "name_change"].includes(product.kind);

  if (product.kind === "frame") {
    if (!frameId || !PROFILE_FRAMES.some((f) => f.id === frameId && f.id !== "none")) {
      return NextResponse.json({ error: "У товара некорректная рамка" }, { status: 400 });
    }
    const owned = await db
      .select({ id: userFrames.id })
      .from(userFrames)
      .where(and(eq(userFrames.userId, userId), eq(userFrames.frameId, frameId)))
      .get();
    if (owned) {
      return NextResponse.json({ error: "Эта рамка уже куплена" }, { status: 409 });
    }
  }
  if (product.kind === "profile_bg" && me.profileBgUnlocked) {
    return NextResponse.json({ error: "Свой фон уже куплен" }, { status: 409 });
  }

  // Кейс: приз выбираем до списания, чтобы не списать за пустой кейс.
  let prize: CasePrize | null = null;
  if (product.kind === "case") {
    prize = pickPrize(parsePrizes(payload));
    if (!prize) {
      return NextResponse.json({ error: "У кейса не настроены призы" }, { status: 400 });
    }
    if (prize.kind === "frame") {
      const prizeFrame = prize.frame;
      if (
        !prizeFrame ||
        !PROFILE_FRAMES.some((f) => f.id === prizeFrame && f.id !== "none")
      ) {
        return NextResponse.json({ error: "В кейсе некорректная рамка" }, { status: 400 });
      }
    }
  }

  const nameChangeAmount =
    product.kind === "name_change"
      ? Math.max(1, Math.min(10, Math.floor(Number(payload.amount) || 1)))
      : 0;

  if (product.maxPerUser != null && product.maxPerUser > 0) {
    const bought = await db
      .select({ total: count() })
      .from(shopOrders)
      .where(
        and(
          eq(shopOrders.userId, userId),
          eq(shopOrders.productId, product.id),
          sql`${shopOrders.status} IN ('pending', 'delivered')`
        )
      )
      .get();
    if ((bought?.total ?? 0) >= product.maxPerUser) {
      return NextResponse.json(
        { error: "Лимит покупок этого товара исчерпан" },
        { status: 409 }
      );
    }
  }

  if ((me.bld ?? 0) < product.priceBld) {
    return NextResponse.json(
      { error: `Не хватает BLD: нужно ${product.priceBld}` },
      { status: 400 }
    );
  }

  // Условное списание: между проверкой баланса и UPDATE могла пройти другая
  // покупка, поэтому проверяем bld >= price прямо в WHERE.
  const charge = await db
    .update(users)
    .set({ bld: sql`bld - ${product.priceBld}` })
    .where(and(eq(users.id, userId), gte(users.bld, product.priceBld)))
    .run();

  if (charge.rowsAffected === 0) {
    return NextResponse.json({ error: "Недостаточно BLD" }, { status: 400 });
  }

  let orderId: number | null = null;
  let creditsAdded = 0;
  let bldAwarded = 0;
  let chipsAwarded = 0;
  let frameApplied: string | null = null;
  let bgUnlockedNow = false;
  let rewardLabel: string | null = prize?.label ?? null;

  try {
    const orderTitle =
      product.kind === "case" && prize
        ? `${product.title}: ${prize.label}`
        : product.title;

    const wonRequiresDelivery =
      product.kind === "case" &&
      prize != null &&
      ["item", "pet", "title", "nick_effect", "cape"].includes(prize.kind);
    const orderStatus = wonRequiresDelivery ? "pending" : instant ? "delivered" : "pending";

    const inserted = await db
      .insert(shopOrders)
      .values({
        userId,
        productId: product.id,
        nickname: me.nickname,
        productTitle: orderTitle,
        kind: prize && product.kind === "case" ? prize.kind : product.kind,
        priceBld: product.priceBld,
        payload:
          product.kind === "case" && prize
            ? JSON.stringify(prize.payload ?? {})
            : product.payload,
        status: orderStatus,
        completedAt: orderStatus === "delivered" ? new Date() : null,
      })
      .run();
    orderId = Number(inserted.lastInsertRowid);

    // --- Мгновенные товары ---
    if (product.kind === "frame" && frameId) {
      await db.insert(userFrames).values({ userId, frameId }).run();
      frameApplied = frameId;
    } else if (product.kind === "profile_bg") {
      await db
        .update(users)
        .set({ profileBgUnlocked: true })
        .where(eq(users.id, userId))
        .run();
      bgUnlockedNow = true;
    } else if (product.kind === "name_change" && nameChangeAmount > 0) {
      await db
        .update(users)
        .set({ nameChangeCredits: sql`name_change_credits + ${nameChangeAmount}` })
        .where(eq(users.id, userId))
        .run();
      creditsAdded = nameChangeAmount;
    } else if (product.kind === "case" && prize) {
      // --- Приз кейса ---
      if (prize.kind === "bld" || prize.kind === "nothing") {
        const amount = prize.kind === "bld" ? prize.amount ?? 1 : 0;
        if (amount > 0) {
          await db
            .update(users)
            .set({ bld: sql`bld + ${amount}` })
            .where(eq(users.id, userId))
            .run();
          bldAwarded = amount;
        }
      } else if (prize.kind === "chips") {
        const amount = prize.amount ?? 1;
        await db
          .update(users)
          .set({ chips: sql`chips + ${amount}` })
          .where(eq(users.id, userId))
          .run();
        chipsAwarded = amount;
      } else if (prize.kind === "frame" && prize.frame) {
        const owned = await db
          .select({ id: userFrames.id })
          .from(userFrames)
          .where(and(eq(userFrames.userId, userId), eq(userFrames.frameId, prize.frame)))
          .get();
        if (owned) {
          const compensation = prize.duplicateBld ?? 40;
          rewardLabel = `${prize.label} (уже есть → +${compensation} BLD)`;
          if (compensation > 0) {
            await db
              .update(users)
              .set({ bld: sql`bld + ${compensation}` })
              .where(eq(users.id, userId))
              .run();
            bldAwarded = compensation;
          }
        } else {
          await db.insert(userFrames).values({ userId, frameId: prize.frame }).run();
          frameApplied = prize.frame;
        }
      } else if (prize.kind === "profile_bg") {
        if (me.profileBgUnlocked) {
          const compensation = prize.duplicateBld ?? 50;
          rewardLabel = `${prize.label} (уже есть → +${compensation} BLD)`;
          if (compensation > 0) {
            await db
              .update(users)
              .set({ bld: sql`bld + ${compensation}` })
              .where(eq(users.id, userId))
              .run();
            bldAwarded = compensation;
          }
        } else {
          await db
            .update(users)
            .set({ profileBgUnlocked: true })
            .where(eq(users.id, userId))
            .run();
          bgUnlockedNow = true;
        }
      }
    }

    const updated = await db
      .select({ bld: users.bld, chips: users.chips })
      .from(users)
      .where(eq(users.id, userId))
      .get();
    const balance = updated?.bld ?? 0;
    const chipsBalance = updated?.chips ?? 0;

    await db
      .insert(walletLedger)
      .values({
        userId,
        currency: "bld",
        amount: -product.priceBld,
        balanceAfter: balance,
        reason: `Покупка: ${product.title}`,
        refType: "shop_order",
        refId: orderId,
      })
      .run();

    if (bldAwarded > 0) {
      await db
        .insert(walletLedger)
        .values({
          userId,
          currency: "bld",
          amount: bldAwarded,
          balanceAfter: balance,
          reason: `Кейс: ${rewardLabel ?? product.title}`,
          refType: "shop_order",
          refId: orderId,
        })
        .run();
    }
    if (chipsAwarded > 0) {
      await db
        .insert(walletLedger)
        .values({
          userId,
          currency: "chips",
          amount: chipsAwarded,
          balanceAfter: chipsBalance,
          reason: `Кейс: ${rewardLabel ?? product.title}`,
          refType: "shop_order",
          refId: orderId,
        })
        .run();
    }

    return NextResponse.json({
      bld: balance,
      order: {
        id: orderId,
        title: orderTitle,
        kind: prize && product.kind === "case" ? prize.kind : product.kind,
        priceBld: product.priceBld,
        status: orderStatus,
      },
      reward:
        product.kind === "case" || product.kind === "name_change"
          ? {
              label:
                product.kind === "name_change"
                  ? `Смена ника ×${nameChangeAmount}`
                  : rewardLabel,
              kind: product.kind === "name_change" ? "name_change" : prize?.kind ?? "nothing",
            }
          : null,
    });
  } catch (error) {
    // Откатываем всё, что успели записать, и возвращаем деньги.
    if (orderId != null) {
      await db
        .update(shopOrders)
        .set({
          status: "refunded",
          error: "Ошибка выдачи — BLD возвращены",
          completedAt: new Date(),
        })
        .where(eq(shopOrders.id, orderId))
        .run();
    }
    if (frameApplied) {
      await db
        .delete(userFrames)
        .where(and(eq(userFrames.userId, userId), eq(userFrames.frameId, frameApplied)))
        .run();
    }
    if (bgUnlockedNow) {
      await db
        .update(users)
        .set({ profileBgUnlocked: false })
        .where(eq(users.id, userId))
        .run();
    }
    if (creditsAdded > 0) {
      await db
        .update(users)
        .set({
          nameChangeCredits: sql`max(0, name_change_credits - ${creditsAdded})`,
        })
        .where(eq(users.id, userId))
        .run();
    }
    if (bldAwarded > 0) {
      await db
        .update(users)
        .set({ bld: sql`bld - ${bldAwarded}` })
        .where(eq(users.id, userId))
        .run();
    }
    if (chipsAwarded > 0) {
      await db
        .update(users)
        .set({ chips: sql`max(0, chips - ${chipsAwarded})` })
        .where(eq(users.id, userId))
        .run();
    }

    await db
      .update(users)
      .set({ bld: sql`bld + ${product.priceBld}` })
      .where(eq(users.id, userId))
      .run();

    const refunded = await db
      .select({ bld: users.bld })
      .from(users)
      .where(eq(users.id, userId))
      .get();

    await db
      .insert(walletLedger)
      .values({
        userId,
        currency: "bld",
        amount: product.priceBld,
        balanceAfter: refunded?.bld ?? 0,
        reason: `Возврат: ${product.title}`,
        refType: "shop_order",
        refId: orderId,
      })
      .run();

    console.error("Shop buy error:", error);
    return NextResponse.json({ error: "Не удалось создать заказ" }, { status: 500 });
  }
}
