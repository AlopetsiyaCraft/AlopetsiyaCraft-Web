import Link from "next/link";
import { redirect } from "next/navigation";
import { count, desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { marketListings, playerInventories, seasons, users } from "@/lib/db/schema";
import Header from "@/components/Header";
import MarketSellForm, { type SellableItem } from "@/components/market/MarketSellForm";
import { parseInventoryData, type ContainerKey, type InventoryStack } from "@/lib/inventory";
import { resolveItemMeta } from "@/lib/market";

const CONTAINERS: ContainerKey[] = ["main", "armor", "offhand", "enderChest"];

/** /market/sell — выбрать предмет из снимка инвентаря и выставить лот. */
export default async function MarketSellPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/login?callbackUrl=%2Fmarket%2Fsell");
  }
  const userId = parseInt(session.user.id, 10);

  const [me, allSeasons] = await Promise.all([
    db
      .select({ id: users.id, nickname: users.nickname, skinUrl: users.skinUrl, bld: users.bld })
      .from(users)
      .where(eq(users.id, userId))
      .get(),
    db.select().from(seasons).orderBy(desc(seasons.number)).all(),
  ]);
  if (!me) redirect("/auth/login");

  const [inventoryRow, activeCount] = await Promise.all([
    db
      .select({ data: playerInventories.data })
      .from(playerInventories)
      .where(eq(playerInventories.nickname, me.nickname.toLowerCase()))
      .get(),
    db
      .select({ total: count() })
      .from(marketListings)
      .where(eq(marketListings.status, "active"))
      .get(),
  ]);

  const inventory = inventoryRow ? parseInventoryData(inventoryRow.data) : null;
  const rawItems: Array<{ container: ContainerKey; slot: number; stack: InventoryStack }> = [];
  if (inventory) {
    for (const container of CONTAINERS) {
      inventory.containers[container].forEach((stack, slot) => {
        if (stack) rawItems.push({ container, slot, stack });
      });
    }
  }

  const items: SellableItem[] = await Promise.all(
    rawItems.map(async ({ container, slot, stack }) => {
      const meta = await resolveItemMeta(stack.id, stack.name);
      return {
        container,
        slot,
        material: stack.id,
        title: meta.title,
        icon: meta.icon,
        count: stack.count,
      };
    })
  );

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)]">
      <Header
        seasons={allSeasons}
        user={{ name: me.nickname, skinUrl: me.skinUrl, bld: me.bld }}
        isLoggedIn
      />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="mc-title text-3xl">Продать предмет</h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Выбери предмет из последнего снимка инвентаря и назначь цену в BLD.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/market/my" className="mc-btn px-3 py-1.5 text-xs">
              Мои лоты ({activeCount?.total ?? 0})
            </Link>
            <Link href="/market" className="mc-btn px-3 py-1.5 text-xs">
              ← Маркет
            </Link>
          </div>
        </div>

        {!inventory ? (
          <div className="mc-inset p-8 text-center text-sm text-[var(--text-muted)]">
            Инвентарь ещё не сохранялся. Зайди на сервер и выйди — мод пришлёт
            снимок, после этого предметы можно будет выставлять.
          </div>
        ) : (
          <>
            <div className="mb-4 border-2 border-black bg-[rgba(242,201,76,0.1)] px-3 py-2 text-xs text-[var(--mc-gold)]">
              Предмет списывается из снимка инвентаря. В игре он останется до
              следующего сохранения — не выставляй вещи, которыми пользуешься.
            </div>
            <MarketSellForm items={items} />
          </>
        )}
      </main>
    </div>
  );
}

export const metadata = {
  title: "Продать предмет",
};
