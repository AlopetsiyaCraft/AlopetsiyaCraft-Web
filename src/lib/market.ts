import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  marketListings,
  marketSales,
  notifications,
  playerInventories,
  shopOrders,
  users,
  walletLedger,
} from "@/lib/db/schema";
import { parseInventoryData, type ContainerKey, type InventoryStack } from "@/lib/inventory";
import { localizeItemSmart, itemRenderIconUrl } from "@/lib/mcAssets";
import { notifyDiscordEvent, notifyDiscordUser } from "@/lib/discord";

/** Комиссия маркета в процентах: уходит из выплаты продавцу. */
export const MARKET_FEE_PERCENT = 5;

export function feeFor(priceBld: number): number {
  return Math.max(0, Math.round((priceBld * MARKET_FEE_PERCENT) / 100));
}

export function marketItemKey(material: string): string {
  return material.trim().toLowerCase();
}

/** Название и иконка предмета для витрины. */
export async function resolveItemMeta(
  material: string,
  fallbackName?: string | null
): Promise<{ title: string; icon: string }> {
  const title = await localizeItemSmart(material, fallbackName || material);
  const icon = itemRenderIconUrl(material, fallbackName || null) ?? "";
  return { title, icon };
}

/** Человеческое название предмета для заказа моду. */
export function itemDisplayName(stack: InventoryStack): string {
  return stack.name || stack.id;
}

/** Превращает стек инвентаря в payload для мода (kind=item). */
export function stackToShopPayload(stack: InventoryStack): Record<string, unknown> {
  const enchants: Record<string, number> = {};
  for (const enchantment of stack.enchantments ?? []) {
    enchants[enchantment.id] = enchantment.lvl;
  }
  return {
    material: stack.id,
    count: 1,
    name: stack.name,
    lore: stack.lore ?? [],
    enchants,
  };
}

/**
 * Списывает один предмет из последнего снимка инвентаря игрока.
 * Возвращает стек для лота или ошибку.
 */
export async function takeInventoryItem(
  nickname: string,
  container: ContainerKey,
  slot: number
): Promise<{ stack: InventoryStack } | { error: string }> {
  const key = nickname.toLowerCase();
  const row = await db
    .select({ data: playerInventories.data })
    .from(playerInventories)
    .where(eq(playerInventories.nickname, key))
    .get();
  if (!row) return { error: "Инвентарь ещё не сохранялся — зайди на сервер и выйди" };

  const inventory = parseInventoryData(row.data);
  if (!inventory) return { error: "Не удалось прочитать инвентарь" };
  const list = inventory.containers[container];
  const stack = list?.[slot];
  if (!stack) return { error: "Предмет не найден — обнови снимок инвентаря" };

  list[slot] = stack.count > 1 ? { ...stack, count: stack.count - 1 } : null;

  await db
    .update(playerInventories)
    .set({ data: JSON.stringify(inventory), updatedAt: new Date() })
    .where(eq(playerInventories.nickname, key))
    .run();

  return { stack: { ...stack, count: 1 } };
}

/** Возвращает предмет в снимок инвентаря (отмена лота). */
export async function returnInventoryItem(
  nickname: string,
  stack: InventoryStack
): Promise<boolean> {
  const key = nickname.toLowerCase();
  const row = await db
    .select({ data: playerInventories.data })
    .from(playerInventories)
    .where(eq(playerInventories.nickname, key))
    .get();
  if (!row) return false;
  const inventory = parseInventoryData(row.data);
  if (!inventory) return false;

  const containers: ContainerKey[] = ["main", "enderChest"];
  for (const container of containers) {
    const list = inventory.containers[container];
    // Сначала добиваем существующую стопку того же предмета.
    for (let i = 0; i < list.length; i++) {
      const existing = list[i];
      if (existing && existing.id === stack.id && existing.count < 64) {
        list[i] = { ...existing, count: existing.count + 1 };
        await saveInventory(key, inventory);
        return true;
      }
    }
    for (let i = 0; i < list.length; i++) {
      if (list[i] == null) {
        list[i] = { ...stack, count: 1 };
        await saveInventory(key, inventory);
        return true;
      }
    }
  }
  return false;
}

async function saveInventory(key: string, inventory: unknown) {
  await db
    .update(playerInventories)
    .set({ data: JSON.stringify(inventory), updatedAt: new Date() })
    .where(eq(playerInventories.nickname, key))
    .run();
}

/** Создаёт заказ на выдачу предмета покупателю. */
export async function createDeliveryOrder(params: {
  buyerId: number;
  buyerNickname: string;
  listing: {
    itemKey: string;
    title: string;
    material: string;
    itemData: string;
    priceBld: number;
  };
}): Promise<number | null> {
  let stack: InventoryStack | null = null;
  try {
    stack = JSON.parse(params.listing.itemData) as InventoryStack;
  } catch {
    stack = null;
  }
  const payload = stack
    ? stackToShopPayload(stack)
    : { material: params.listing.material, count: 1 };

  const inserted = await db
    .insert(shopOrders)
    .values({
      userId: params.buyerId,
      productId: null,
      nickname: params.buyerNickname,
      productTitle: `Маркет: ${params.listing.title}`,
      kind: "item",
      priceBld: params.listing.priceBld,
      payload: JSON.stringify(payload),
      status: "pending",
    })
    .run();
  return Number(inserted.lastInsertRowid);
}

export interface SaleResult {
  ok: boolean;
  error?: string;
  feeBld?: number;
  sellerGain?: number;
  refundBld?: number;
}

/**
 * Завершает продажу лота.
 *
 * payment = "charge" — покупатель платит сейчас (прямая покупка).
 * payment = "reserved" — BLD уже списаны при создании заявки, разницу
 * возвращаем покупателю.
 */
export async function completeSale(params: {
  listing: {
    id: number;
    sellerId: number;
    sellerNickname: string;
    itemKey: string;
    title: string;
    material: string;
    icon: string;
    itemData: string;
    priceBld: number;
  };
  buyer: { id: number; nickname: string };
  payment: "charge" | "reserved";
  reservedBld?: number;
}): Promise<SaleResult> {
  const { listing, buyer } = params;
  if (listing.sellerId === buyer.id) {
    return { ok: false, error: "Нельзя купить свой лот" };
  }

  const claimed = await db
    .update(marketListings)
    .set({
      status: "sold",
      buyerId: buyer.id,
      buyerNickname: buyer.nickname,
      soldAt: new Date(),
    })
    .where(and(eq(marketListings.id, listing.id), eq(marketListings.status, "active")))
    .run();
  if (claimed.rowsAffected === 0) {
    return { ok: false, error: "Лот уже продан" };
  }

  const fee = feeFor(listing.priceBld);
  const sellerGain = listing.priceBld - fee;
  let refund = 0;

  try {
    if (params.payment === "charge") {
      const charged = await db
        .update(users)
        .set({ bld: sql`bld - ${listing.priceBld}` })
        .where(and(eq(users.id, buyer.id), gte(users.bld, listing.priceBld)))
        .run();
      if (charged.rowsAffected === 0) {
        await db
          .update(marketListings)
          .set({ status: "active", buyerId: null, buyerNickname: null, soldAt: null })
          .where(eq(marketListings.id, listing.id))
          .run();
        return { ok: false, error: "Недостаточно BLD" };
      }
    } else {
      const reserved = params.reservedBld ?? listing.priceBld;
      refund = Math.max(0, reserved - listing.priceBld);
      if (refund > 0) {
        await db
          .update(users)
          .set({ bld: sql`bld + ${refund}` })
          .where(eq(users.id, buyer.id))
          .run();
      }
    }

    await db
      .update(users)
      .set({ bld: sql`bld + ${sellerGain}` })
      .where(eq(users.id, listing.sellerId))
      .run();

    const buyerRow = await db
      .select({ bld: users.bld })
      .from(users)
      .where(eq(users.id, buyer.id))
      .get();
    const sellerRow = await db
      .select({ bld: users.bld })
      .from(users)
      .where(eq(users.id, listing.sellerId))
      .get();

    if (params.payment === "charge") {
      await db
        .insert(walletLedger)
        .values({
          userId: buyer.id,
          currency: "bld",
          amount: -listing.priceBld,
          balanceAfter: buyerRow?.bld ?? 0,
          reason: `Маркет: ${listing.title}`,
          refType: "market_listing",
          refId: listing.id,
        })
        .run();
    } else if (refund > 0) {
      await db
        .insert(walletLedger)
        .values({
          userId: buyer.id,
          currency: "bld",
          amount: refund,
          balanceAfter: buyerRow?.bld ?? 0,
          reason: `Маркет: разница по заявке (${listing.title})`,
          refType: "market_listing",
          refId: listing.id,
        })
        .run();
    }

    await db
      .insert(walletLedger)
      .values({
        userId: listing.sellerId,
        currency: "bld",
        amount: sellerGain,
        balanceAfter: sellerRow?.bld ?? 0,
        reason: `Маркет: продажа ${listing.title} (комиссия ${fee} BLD)`,
        refType: "market_listing",
        refId: listing.id,
      })
      .run();

    await db
      .insert(marketSales)
      .values({
        itemKey: listing.itemKey,
        title: listing.title,
        material: listing.material,
        icon: listing.icon,
        priceBld: listing.priceBld,
        feeBld: fee,
        sellerId: listing.sellerId,
        sellerNickname: listing.sellerNickname,
        buyerId: buyer.id,
        buyerNickname: buyer.nickname,
      })
      .run();

    await createDeliveryOrder({
      buyerId: buyer.id,
      buyerNickname: buyer.nickname,
      listing,
    });

    const link = `/market/${encodeURIComponent(listing.itemKey)}`;
    await db
      .insert(notifications)
      .values({
        userId: listing.sellerId,
        type: "market",
        title: "Предмет продан",
        body: `${listing.title} — ${listing.priceBld} BLD (на баланс ${sellerGain})`,
        link,
      })
      .run();
    await db
      .insert(notifications)
      .values({
        userId: buyer.id,
        type: "market",
        title: "Покупка на маркете",
        body: `${listing.title} — ${listing.priceBld} BLD. Предмет выдадут в игре.`,
        link,
      })
      .run();

    await notifyDiscordUser(
      listing.sellerId,
      `💰 Продан «${listing.title}» за ${listing.priceBld} BLD. На баланс: ${sellerGain} BLD.`
    );
    await notifyDiscordUser(
      buyer.id,
      `🛒 Куплен «${listing.title}» за ${listing.priceBld} BLD. Предмет выдадут в игре.`
    );
    await notifyDiscordEvent({
      title: "Сделка на маркете",
      description: `${listing.title} · ${listing.priceBld} BLD\n${listing.sellerNickname} → ${buyer.nickname}`,
      link,
    });

    return { ok: true, feeBld: fee, sellerGain, refundBld: refund };
  } catch (error) {
    console.error("Market sale error:", error);
    // Лот уже помечен проданным — вернуть его в продажу безопаснее, чем
    // оставить покупателя без предмета и денег.
    await db
      .update(marketListings)
      .set({ status: "active", buyerId: null, buyerNickname: null, soldAt: null })
      .where(eq(marketListings.id, listing.id))
      .run();
    return { ok: false, error: "Не удалось завершить сделку" };
  }
}
