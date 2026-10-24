import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, or } from "drizzle-orm";
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
import MarketCancelButton from "@/components/market/MarketCancelButton";

/** /market/my — мои лоты, заявки и история сделок. */
export default async function MyMarketPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/login?callbackUrl=%2Fmarket%2Fmy");
  }
  const userId = parseInt(session.user.id, 10);

  const [me, allSeasons, listings, orders, sales] = await Promise.all([
    db
      .select({ id: users.id, nickname: users.nickname, skinUrl: users.skinUrl, bld: users.bld })
      .from(users)
      .where(eq(users.id, userId))
      .get(),
    db.select().from(seasons).orderBy(desc(seasons.number)).all(),
    db
      .select()
      .from(marketListings)
      .where(and(eq(marketListings.sellerId, userId), eq(marketListings.status, "active")))
      .orderBy(desc(marketListings.createdAt))
      .all(),
    db
      .select()
      .from(marketOrders)
      .where(and(eq(marketOrders.userId, userId), eq(marketOrders.status, "active")))
      .orderBy(desc(marketOrders.createdAt))
      .all(),
    db
      .select()
      .from(marketSales)
      .where(or(eq(marketSales.sellerId, userId), eq(marketSales.buyerId, userId)))
      .orderBy(desc(marketSales.createdAt))
      .limit(30)
      .all(),
  ]);
  if (!me) redirect("/auth/login");

  const earned = sales
    .filter((sale) => sale.sellerId === userId)
    .reduce((sum, sale) => sum + sale.priceBld - sale.feeBld, 0);
  const spent = sales
    .filter((sale) => sale.buyerId === userId)
    .reduce((sum, sale) => sum + sale.priceBld, 0);

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
            <h1 className="mc-title text-3xl">Мои лоты</h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Активные лоты, заявки и история сделок на маркете.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="mc-chip font-mono text-[var(--mc-gold)]">
              {me.bld.toLocaleString("ru-RU")} BLD
            </span>
            <Link href="/market/sell" className="mc-btn mc-btn-primary px-3 py-1.5 text-xs">
              Продать предмет
            </Link>
            <Link href="/market" className="mc-btn px-3 py-1.5 text-xs">
              ← Маркет
            </Link>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Активных лотов" value={String(listings.length)} />
          <Stat label="Активных заявок" value={String(orders.length)} />
          <Stat label="Заработано" value={`${earned.toLocaleString("ru-RU")} BLD`} />
          <Stat label="Потрачено" value={`${spent.toLocaleString("ru-RU")} BLD`} />
        </div>

        <section className="mc-panel mb-4 overflow-hidden">
          <div className="mc-head">Мои лоты</div>
          {listings.length === 0 ? (
            <div className="p-6 text-sm text-[var(--text-muted)]">
              Активных лотов нет.{" "}
              <Link href="/market/sell" className="text-[var(--mc-green-light)] underline">
                Выставить предмет
              </Link>
            </div>
          ) : (
            <ul className="divide-y-2 divide-black/40">
              {listings.map((listing) => (
                <li
                  key={listing.id}
                  className="flex flex-wrap items-center gap-3 px-3 py-2.5"
                >
                  <span className="mc-inset flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden">
                    {listing.icon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={listing.icon} alt="" className="h-7 w-7 pixelated" />
                    ) : (
                      "📦"
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/market/${encodeURIComponent(listing.itemKey)}`}
                      className="block truncate text-sm hover:text-[var(--mc-green-light)]"
                    >
                      {listing.title}
                    </Link>
                    <div className="font-mono text-[0.58rem] text-[var(--text-muted)]">
                      {new Date(listing.createdAt).toLocaleString("ru-RU")}
                    </div>
                  </div>
                  <span className="font-mono text-sm text-[var(--mc-gold)]">
                    {listing.priceBld.toLocaleString("ru-RU")} BLD
                  </span>
                  <MarketCancelButton type="listing" id={listing.id} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mc-panel mb-4 overflow-hidden">
          <div className="mc-head">Мои заявки на покупку</div>
          {orders.length === 0 ? (
            <div className="p-6 text-sm text-[var(--text-muted)]">Активных заявок нет.</div>
          ) : (
            <ul className="divide-y-2 divide-black/40">
              {orders.map((order) => (
                <li key={order.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/market/${encodeURIComponent(order.itemKey)}`}
                      className="block truncate text-sm hover:text-[var(--mc-green-light)]"
                    >
                      {order.title}
                    </Link>
                    <div className="font-mono text-[0.58rem] text-[var(--text-muted)]">
                      {new Date(order.createdAt).toLocaleString("ru-RU")}
                    </div>
                  </div>
                  <span className="font-mono text-sm text-[var(--mc-gold)]">
                    {order.priceBld.toLocaleString("ru-RU")} BLD
                  </span>
                  <MarketCancelButton type="order" id={order.id} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mc-panel overflow-hidden">
          <div className="mc-head">История сделок</div>
          {sales.length === 0 ? (
            <div className="p-6 text-sm text-[var(--text-muted)]">Сделок пока не было.</div>
          ) : (
            <ul className="divide-y-2 divide-black/40">
              {sales.map((sale) => {
                const sold = sale.sellerId === userId;
                return (
                  <li key={sale.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                    <span
                      className={`mc-chip text-[0.55rem] ${
                        sold ? "text-[var(--mc-green-light)]" : "text-[var(--mc-blue)]"
                      }`}
                    >
                      {sold ? "продал" : "купил"}
                    </span>
                    <Link
                      href={`/market/${encodeURIComponent(sale.itemKey)}`}
                      className="min-w-0 flex-1 truncate text-xs hover:text-[var(--mc-green-light)]"
                    >
                      {sale.title}
                    </Link>
                    <span className="text-[0.6rem] text-[var(--text-muted)]">
                      {sold ? sale.buyerNickname : sale.sellerNickname}
                    </span>
                    <span
                      className={`font-mono text-xs ${
                        sold ? "text-[var(--mc-green-light)]" : "text-[var(--mc-red)]"
                      }`}
                    >
                      {sold ? "+" : "−"}
                      {(sold ? sale.priceBld - sale.feeBld : sale.priceBld).toLocaleString("ru-RU")}{" "}
                      BLD
                    </span>
                    <span className="font-mono text-[0.58rem] text-[var(--text-muted)]">
                      {new Date(sale.createdAt).toLocaleDateString("ru-RU")}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
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
  title: "Мои лоты",
};
