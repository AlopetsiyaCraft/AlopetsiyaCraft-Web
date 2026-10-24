import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  marketListings,
  marketOrders,
  marketSales,
  seasons,
  users,
} from "@/lib/db/schema";
import Header from "@/components/Header";
import MarketBuyButton from "@/components/market/MarketBuyButton";
import MarketCancelButton from "@/components/market/MarketCancelButton";
import MarketOrderForm from "@/components/market/MarketOrderForm";
import MarketPriceChart from "@/components/market/MarketPriceChart";
import { MARKET_FEE_PERCENT } from "@/lib/market";

/** /market/<itemKey> — лоты, заявки и история цены по предмету. */
export default async function MarketItemPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  let itemKey = key;
  try {
    itemKey = decodeURIComponent(key).toLowerCase();
  } catch {
    itemKey = key.toLowerCase();
  }

  const session = await auth();
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : null;

  const [allSeasons, me, listings, orders, sales] = await Promise.all([
    db.select().from(seasons).orderBy(desc(seasons.number)).all(),
    userId
      ? db
          .select({ id: users.id, name: users.nickname, skinUrl: users.skinUrl, bld: users.bld })
          .from(users)
          .where(eq(users.id, userId))
          .get()
      : null,
    db
      .select()
      .from(marketListings)
      .where(and(eq(marketListings.itemKey, itemKey), eq(marketListings.status, "active")))
      .orderBy(asc(marketListings.priceBld), asc(marketListings.createdAt))
      .all(),
    db
      .select()
      .from(marketOrders)
      .where(and(eq(marketOrders.itemKey, itemKey), eq(marketOrders.status, "active")))
      .orderBy(desc(marketOrders.priceBld), asc(marketOrders.createdAt))
      .all(),
    db
      .select()
      .from(marketSales)
      .where(eq(marketSales.itemKey, itemKey))
      .orderBy(desc(marketSales.createdAt))
      .limit(40)
      .all(),
  ]);

  const known = listings[0] ?? sales[0] ?? orders[0];
  if (!known) notFound();

  const title = known.title;
  const icon = known.icon;
  const material = known.material;
  const floor = listings[0]?.priceBld ?? null;
  const lastSale = sales[0]?.priceBld ?? null;
  const avg = sales.length
    ? Math.round(sales.reduce((sum, sale) => sum + sale.priceBld, 0) / sales.length)
    : null;
  const max = sales.length ? Math.max(...sales.map((sale) => sale.priceBld)) : null;
  const chartSales = [...sales]
    .reverse()
    .map((sale) => ({ priceBld: sale.priceBld, createdAt: sale.createdAt.getTime() }));
  const bestOrder = orders[0]?.priceBld ?? null;

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)]">
      <Header
        seasons={allSeasons}
        user={me ? { name: me.name, skinUrl: me.skinUrl, bld: me.bld } : undefined}
        isLoggedIn={!!session}
      />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <div className="mb-5">
          <Link href="/market" className="text-sm text-[var(--mc-green)] hover:underline">
            ← Назад на маркет
          </Link>
        </div>

        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mc-inset flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden">
              {icon ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={icon} alt="" className="h-11 w-11 pixelated" />
              ) : (
                <span className="text-2xl">📦</span>
              )}
            </span>
            <div className="min-w-0">
              <h1 className="mc-title truncate text-2xl sm:text-3xl">{title}</h1>
              <p className="font-mono text-xs text-[var(--text-muted)]">{material}</p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                Комиссия {MARKET_FEE_PERCENT}% · выдача предмета модом при следующем
                заходе.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {me && (
              <span className="mc-chip font-mono text-[var(--mc-gold)]">
                {me.bld.toLocaleString("ru-RU")} BLD
              </span>
            )}
            <Link href="/market/sell" className="mc-btn px-3 py-1.5 text-xs">
              Продать такой
            </Link>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Минимальная цена" value={floor != null ? `${floor} BLD` : "—"} />
          <Stat label="Последняя сделка" value={lastSale != null ? `${lastSale} BLD` : "—"} />
          <Stat label="Средняя" value={avg != null ? `${avg} BLD` : "—"} />
          <Stat label="Максимум" value={max != null ? `${max} BLD` : "—"} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="flex flex-col gap-4">
            <section className="mc-panel overflow-hidden">
              <div className="mc-head">
                <span className="min-w-0 flex-1 truncate">График цены</span>
                <span className="mc-chip text-[0.58rem] text-[var(--text-muted)]">
                  {sales.length} сделок
                </span>
              </div>
              <div className="p-3">
                <MarketPriceChart sales={chartSales} />
              </div>
            </section>

            <section className="mc-panel overflow-hidden">
              <div className="mc-head">
                <span className="min-w-0 flex-1 truncate">Лоты</span>
                <span className="mc-chip text-[0.58rem] text-[var(--text-muted)]">
                  {listings.length}
                </span>
              </div>
              {listings.length === 0 ? (
                <div className="p-6 text-sm text-[var(--text-muted)]">
                  Активных лотов нет. Можно оставить заявку на покупку.
                </div>
              ) : (
                <ul className="divide-y-2 divide-black/40">
                  {listings.map((listing) => {
                    const own = me?.id === listing.sellerId;
                    const notEnough = me ? me.bld < listing.priceBld : false;
                    return (
                      <li
                        key={listing.id}
                        className="flex flex-wrap items-center gap-3 px-3 py-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm">{listing.title}</div>
                          <div className="text-[0.6rem] text-[var(--text-muted)]">
                            {listing.sellerNickname} ·{" "}
                            {new Date(listing.createdAt).toLocaleString("ru-RU")}
                          </div>
                        </div>
                        <span className="font-mono text-sm text-[var(--mc-gold)]">
                          {listing.priceBld.toLocaleString("ru-RU")} BLD
                        </span>
                        {own ? (
                          <MarketCancelButton type="listing" id={listing.id} label="Снять лот" />
                        ) : !me ? (
                          <Link
                            href="/auth/login"
                            className="mc-btn px-3 py-1.5 text-xs"
                          >
                            Войти
                          </Link>
                        ) : (
                          <div className="flex flex-col items-end gap-1">
                            <MarketBuyButton
                              listingId={listing.id}
                              priceBld={listing.priceBld}
                              disabled={notEnough}
                            />
                            {notEnough && (
                              <span className="text-[0.58rem] text-[var(--mc-red)]">
                                не хватает {listing.priceBld - me.bld} BLD
                              </span>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="mc-panel overflow-hidden">
              <div className="mc-head">История сделок</div>
              {sales.length === 0 ? (
                <div className="p-6 text-sm text-[var(--text-muted)]">
                  Этот предмет ещё не продавали.
                </div>
              ) : (
                <ul className="divide-y-2 divide-black/40">
                  {sales.slice(0, 15).map((sale) => (
                    <li
                      key={sale.id}
                      className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm"
                    >
                      <span className="font-mono text-xs text-[var(--text-muted)]">
                        {new Date(sale.createdAt).toLocaleString("ru-RU")}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs">
                        {sale.sellerNickname} → {sale.buyerNickname}
                      </span>
                      <span className="font-mono text-xs text-[var(--mc-gold)]">
                        {sale.priceBld.toLocaleString("ru-RU")} BLD
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div className="flex flex-col gap-4">
            <section className="mc-panel overflow-hidden">
              <div className="mc-head">
                <span className="min-w-0 flex-1 truncate">Заявки на покупку</span>
                <span className="mc-chip text-[0.58rem] text-[var(--text-muted)]">
                  {orders.length}
                </span>
              </div>
              <div className="flex flex-col gap-2 p-3">
                <div className="text-xs text-[var(--text-secondary)]">
                  Лучшая заявка:{" "}
                  <span className="font-mono text-[var(--mc-gold)]">
                    {bestOrder != null ? `${bestOrder.toLocaleString("ru-RU")} BLD` : "—"}
                  </span>
                </div>
                {orders.length > 0 && (
                  <ul className="flex flex-col divide-y-2 divide-black/30">
                    {orders.map((order) => (
                      <li key={order.id} className="flex items-center gap-2 py-1.5">
                        <span className="min-w-0 flex-1 truncate text-xs">
                          {order.nickname}
                        </span>
                        <span className="font-mono text-xs text-[var(--mc-gold)]">
                          {order.priceBld.toLocaleString("ru-RU")}
                        </span>
                        {me?.id === order.userId && (
                          <MarketCancelButton type="order" id={order.id} label="Снять" />
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="border-t-2 border-black/40 pt-2">
                  <MarketOrderForm
                    itemKey={itemKey}
                    suggestedPrice={bestOrder ?? floor ?? 10}
                    isLoggedIn={!!me}
                  />
                </div>
              </div>
            </section>

            <section className="mc-panel p-3 text-xs text-[var(--text-muted)]">
              <p className="mb-1 font-bold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                Как это работает
              </p>
              <p>
                Покупатель платит BLD, продавец получает сумму минус{" "}
                {MARKET_FEE_PERCENT}%. Предмет попадает в очередь выдачи и
                появляется в игре при следующем заходе.
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="mc-panel p-4">
      <div className="text-[0.58rem] uppercase tracking-[0.14em] text-[var(--text-muted)]">
        {label}
      </div>
      <div className="mt-1 font-mono text-lg text-[var(--mc-gold)]">{value}</div>
    </div>
  );
}

export const metadata = {
  title: "Предмет на маркете",
};
