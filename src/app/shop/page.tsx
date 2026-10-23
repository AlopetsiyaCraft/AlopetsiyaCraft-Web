import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { seasons, shopOrders, shopProducts, users } from "@/lib/db/schema";
import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import Link from "next/link";
import Header from "@/components/Header";
import DailyWheel from "@/components/DailyWheel";
import ShopCatalog, {
  type ShopOrderView,
  type ShopProduct,
} from "@/components/ShopCatalog";
import { CHIPS_PER_BLD, DISC_PRICE_BLD } from "@/lib/currency";
import { isDailySpinAvailable, nextDailyBonusReset } from "@/lib/dailyBonus";

/**
 * Магазин АлопецияКрафт.
 * Каталог товаров живёт в shop_products (редактируется в админке), покупки —
 * в shop_orders. Выдачу заказов забирает мод/плагин через
 * GET /api/shop/orders/pending и отмечает результат.
 */

/** Шансы призов кейса для карточки товара. */
function casePrizeChances(raw: string): Array<{ label: string; chance: number }> | undefined {
  try {
    const payload = JSON.parse(raw) as { prizes?: Array<Record<string, unknown>> };
    const prizes = Array.isArray(payload.prizes) ? payload.prizes : [];
    const valid = prizes
      .map((prize) => ({
        label:
          typeof prize.label === "string" && prize.label.trim()
            ? prize.label.trim()
            : String(prize.kind ?? "приз"),
        weight: Math.max(0, Number(prize.weight) || 0),
      }))
      .filter((prize) => prize.weight > 0);
    const total = valid.reduce((sum, prize) => sum + prize.weight, 0);
    if (total <= 0) return undefined;
    return valid.map((prize) => ({
      label: prize.label,
      chance: Math.round((prize.weight / total) * 1000) / 10,
    }));
  } catch {
    return undefined;
  }
}
export default async function ShopPage() {
  const session = await auth();
  const allSeasons = await db.select().from(seasons).orderBy(desc(seasons.number)).all();
  const catalog = await db
    .select()
    .from(shopProducts)
    .where(eq(shopProducts.isActive, true))
    .orderBy(asc(shopProducts.sortOrder), asc(shopProducts.id))
    .all();

  let user = null;
  let nextSpinAt: number | null = null;
  let orders: ShopOrderView[] = [];
  let purchasedCounts: Record<number, number> = {};

  if (session?.user?.id) {
    const userId = parseInt(session.user.id, 10);
    user = await db
      .select({
        name: users.nickname,
        skinUrl: users.skinUrl,
        bld: users.bld,
        chips: users.chips,
        dailyBonusAt: users.dailyBonusAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .get();

    if (user?.dailyBonusAt && !isDailySpinAvailable(user.dailyBonusAt)) {
      nextSpinAt = nextDailyBonusReset().getTime();
    }

    const [recentOrders, countRows] = await Promise.all([
      db
        .select({
          id: shopOrders.id,
          productTitle: shopOrders.productTitle,
          kind: shopOrders.kind,
          priceBld: shopOrders.priceBld,
          status: shopOrders.status,
          createdAt: shopOrders.createdAt,
          error: shopOrders.error,
        })
        .from(shopOrders)
        .where(eq(shopOrders.userId, userId))
        .orderBy(desc(shopOrders.createdAt))
        .limit(10)
        .all(),
      db
        .select({ productId: shopOrders.productId, total: count() })
        .from(shopOrders)
        .where(
          and(
            eq(shopOrders.userId, userId),
            sql`${shopOrders.status} IN ('pending', 'delivered')`
          )
        )
        .groupBy(shopOrders.productId)
        .all(),
    ]);

    orders = recentOrders.map((order) => ({
      id: order.id,
      title: order.productTitle,
      kind: order.kind,
      priceBld: order.priceBld,
      status: order.status,
      createdAt: order.createdAt.toISOString(),
      error: order.error,
    }));
    purchasedCounts = Object.fromEntries(
      countRows
        .filter((row): row is { productId: number; total: number } => row.productId != null)
        .map((row) => [row.productId, row.total])
    );
  }

  const products: ShopProduct[] = catalog.map((product) => ({
    id: product.id,
    slug: product.slug,
    title: product.title,
    description: product.description,
    category: product.category,
    icon: product.icon,
    priceBld: product.priceBld,
    kind: product.kind,
    maxPerUser: product.maxPerUser,
    casePrizes: product.kind === "case" ? casePrizeChances(product.payload) : undefined,
  }));

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)]">
      <Header
        seasons={allSeasons}
        user={user ? { name: user.name, skinUrl: user.skinUrl, bld: user.bld } : undefined}
        isLoggedIn={!!session}
      />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="mc-title text-3xl sm:text-4xl">Магазин</h1>
            <p className="mt-1 max-w-2xl text-sm text-[var(--text-secondary)]">
              Покупки за болды (BLD). После оплаты заказ ждёт выдачи в игре — мод
              заберёт его при следующем заходе.
            </p>
          </div>
        </div>

        <div className="mb-6">
          <DailyWheel
            isLoggedIn={!!session}
            initialBld={user?.bld ?? 0}
            initialChips={user?.chips ?? 0}
            initialNextSpinAt={nextSpinAt}
          />
        </div>

        <ShopCatalog
          products={products}
          initialBld={user?.bld ?? 0}
          isLoggedIn={!!session}
          initialOrders={orders}
          purchasedCounts={purchasedCounts}
        />

        <section className="mt-8">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
            Сервисы
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="mc-panel flex items-start gap-3 p-5">
              <div className="mc-inset flex h-12 w-12 shrink-0 items-center justify-center text-2xl">
                💿
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold uppercase tracking-[0.08em]">
                  Кастомная пластинка
                </h3>
                <p className="mt-1 text-sm leading-snug text-[var(--text-secondary)]">
                  Закажи свою песню в игру: пластинку выдадут в инвентарь на сервере.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span className="font-mono text-sm text-[var(--mc-gold)]">
                    {DISC_PRICE_BLD} BLD
                  </span>
                  <Link href="/music" className="mc-btn mc-btn-primary px-3 py-1.5 text-xs">
                    К музыке
                  </Link>
                </div>
              </div>
            </div>

            <div className="mc-panel flex items-start gap-3 p-5">
              <div className="mc-inset flex h-12 w-12 shrink-0 items-center justify-center text-2xl">
                🎰
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold uppercase tracking-[0.08em]">
                  Казино-фишки
                </h3>
                <p className="mt-1 text-sm leading-snug text-[var(--text-secondary)]">
                  Обменяй болды на фишки для столов: блэкджек, покер и дурак.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span className="font-mono text-sm text-[var(--mc-gold)]">
                    1 BLD = {CHIPS_PER_BLD} фишек
                  </span>
                  <Link href="/wallet" className="mc-btn mc-btn-primary px-3 py-1.5 text-xs">
                    В кошелёк
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
export const metadata = {
  title: "Магазин",
  description: "Витрина АлопецияКрафт: косметика, питомцы и кастомные предметы за болды",
};
