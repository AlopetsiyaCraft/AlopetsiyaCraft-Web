import Link from "next/link";
import { count, desc, eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { marketListings, marketOrders, marketSales, seasons, users } from "@/lib/db/schema";
import Header from "@/components/Header";
import { MARKET_FEE_PERCENT } from "@/lib/market";

/** /market — витрина предметов: предложение, спрос и последние сделки. */
export default async function MarketPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();
  const sort = sp.sort ?? "supply";

  const session = await auth();
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : null;

  const [allSeasons, me, catalog, demandRows, recentSales, listingTotal, orderTotal] =
    await Promise.all([
      db.select().from(seasons).orderBy(desc(seasons.number)).all(),
      userId
        ? db
            .select({ name: users.nickname, skinUrl: users.skinUrl, bld: users.bld })
            .from(users)
            .where(eq(users.id, userId))
            .get()
        : null,
      db
        .select({
          itemKey: marketListings.itemKey,
          title: sql<string>`min(${marketListings.title})`,
          icon: sql<string>`min(${marketListings.icon})`,
          material: sql<string>`min(${marketListings.material})`,
          supply: count(),
          floor: sql<number>`min(${marketListings.priceBld})`,
        })
        .from(marketListings)
        .where(eq(marketListings.status, "active"))
        .groupBy(marketListings.itemKey)
        .all(),
      db
        .select({ itemKey: marketOrders.itemKey, demand: count() })
        .from(marketOrders)
        .where(eq(marketOrders.status, "active"))
        .groupBy(marketOrders.itemKey)
        .all(),
      db.select().from(marketSales).orderBy(desc(marketSales.createdAt)).limit(60).all(),
      db
        .select({ total: count() })
        .from(marketListings)
        .where(eq(marketListings.status, "active"))
        .get(),
      db
        .select({ total: count() })
        .from(marketOrders)
        .where(eq(marketOrders.status, "active"))
        .get(),
    ]);

  const demandByKey = new Map(demandRows.map((row) => [row.itemKey, row.demand]));
  const lastSaleByKey = new Map<string, number>();
  for (const sale of recentSales) {
    if (!lastSaleByKey.has(sale.itemKey)) lastSaleByKey.set(sale.itemKey, sale.priceBld);
  }

  const filtered = catalog.filter((item) => {
    if (!q) return true;
    return (
      item.title.toLowerCase().includes(q) ||
      item.material.toLowerCase().includes(q) ||
      item.itemKey.toLowerCase().includes(q)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "price") return Number(a.floor) - Number(b.floor);
    if (sort === "name") return a.title.localeCompare(b.title, "ru");
    if (sort === "new") return 0;
    return Number(b.supply) - Number(a.supply);
  });

  const volume = recentSales.reduce((sum, sale) => sum + sale.priceBld, 0);
  const avgSale =
    recentSales.length > 0 ? Math.round(volume / recentSales.length) : 0;

  const sortHref = (value: string) => {
    const query = new URLSearchParams();
    if (q) query.set("q", q);
    query.set("sort", value);
    return `/market?${query.toString()}`;
  };

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)]">
      <Header
        seasons={allSeasons}
        user={me ? { name: me.name, skinUrl: me.skinUrl, bld: me.bld } : undefined}
        isLoggedIn={!!session}
      />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="mc-title text-3xl sm:text-4xl">Маркет</h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Покупка и продажа предметов между игроками за BLD. Комиссия маркета —{" "}
              {MARKET_FEE_PERCENT}%.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {me && (
              <span className="mc-chip font-mono text-[var(--mc-gold)]">
                {me.bld.toLocaleString("ru-RU")} BLD
              </span>
            )}
            <Link href="/market/my" className="mc-btn px-3 py-1.5 text-xs">
              Мои лоты
            </Link>
            <Link href="/market/sell" className="mc-btn mc-btn-primary px-3 py-1.5 text-xs">
              Продать предмет
            </Link>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Лотов" value={(listingTotal?.total ?? 0).toLocaleString("ru-RU")} />
          <Stat label="Заявок" value={(orderTotal?.total ?? 0).toLocaleString("ru-RU")} />
          <Stat label="Сделок (лента)" value={recentSales.length.toLocaleString("ru-RU")} />
          <Stat
            label="Средняя сделка"
            value={avgSale > 0 ? `${avgSale.toLocaleString("ru-RU")} BLD` : "—"}
          />
        </div>

        <div className="mb-4 flex flex-wrap items-end gap-2">
          <form method="get" className="flex min-w-0 flex-1 gap-2">
            <input type="hidden" name="sort" value={sort} />
            <input
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="Поиск по предмету"
              className="mc-input max-w-sm"
            />
            <button type="submit" className="mc-btn px-3 py-1.5 text-xs">
              Найти
            </button>
          </form>
          <div className="flex gap-1">
            {[
              { key: "supply", label: "По лотам" },
              { key: "price", label: "Дешёвые" },
              { key: "name", label: "По имени" },
            ].map((option) => (
              <Link
                key={option.key}
                href={sortHref(option.key)}
                className={`border-2 px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.08em] ${
                  sort === option.key
                    ? "border-black bg-[var(--mc-green)] text-[#0f1a08]"
                    : "border-black bg-[var(--bg)] text-[var(--text-muted)] hover:bg-[var(--hover)]"
                }`}
              >
                {option.label}
              </Link>
            ))}
          </div>
        </div>

        {sorted.length === 0 ? (
          <div className="mc-inset p-8 text-center text-sm text-[var(--text-muted)]">
            {catalog.length === 0
              ? "На маркете пока нет лотов. Стань первым — выстави предмет из инвентаря."
              : "Ничего не найдено по запросу."}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sorted.map((item) => {
              const demand = demandByKey.get(item.itemKey) ?? 0;
              const lastSale = lastSaleByKey.get(item.itemKey);
              return (
                <Link
                  key={item.itemKey}
                  href={`/market/${encodeURIComponent(item.itemKey)}`}
                  className="mc-panel flex gap-3 p-3 transition-colors hover:bg-[var(--hover)]"
                >
                  <span className="mc-inset flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden">
                    {item.icon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.icon} alt="" className="h-10 w-10 pixelated" />
                    ) : (
                      <span className="text-xl">📦</span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{item.title}</div>
                    <div className="font-mono text-[0.58rem] text-[var(--text-muted)]">
                      {item.material}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[0.6rem] text-[var(--text-secondary)]">
                      <span>
                        от{" "}
                        <span className="font-mono text-[var(--mc-gold)]">
                          {Number(item.floor).toLocaleString("ru-RU")} BLD
                        </span>
                      </span>
                      <span>лоты: {item.supply}</span>
                      <span>заявки: {demand}</span>
                    </div>
                    {lastSale != null && (
                      <div className="mt-0.5 text-[0.58rem] text-[var(--text-muted)]">
                        последняя: {lastSale.toLocaleString("ru-RU")} BLD
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <section className="mc-panel mt-6 overflow-hidden">
          <div className="mc-head">
            <span className="min-w-0 flex-1 truncate">Последние сделки</span>
            <span className="mc-chip text-[0.58rem] text-[var(--text-muted)]">
              {recentSales.length}
            </span>
          </div>
          {recentSales.length === 0 ? (
            <div className="p-6 text-sm text-[var(--text-muted)]">Сделок пока не было.</div>
          ) : (
            <ul className="divide-y-2 divide-black/40">
              {recentSales.slice(0, 12).map((sale) => (
                <li
                  key={sale.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm"
                >
                  <span className="mc-inset flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden">
                    {sale.icon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={sale.icon} alt="" className="h-6 w-6 pixelated" />
                    ) : (
                      "📦"
                    )}
                  </span>
                  <Link
                    href={`/market/${encodeURIComponent(sale.itemKey)}`}
                    className="min-w-0 flex-1 truncate text-xs hover:text-[var(--mc-green-light)]"
                  >
                    {sale.title}
                  </Link>
                  <span className="text-[0.6rem] text-[var(--text-muted)]">
                    {sale.sellerNickname} → {sale.buyerNickname}
                  </span>
                  <span className="font-mono text-xs text-[var(--mc-gold)]">
                    {sale.priceBld.toLocaleString("ru-RU")} BLD
                  </span>
                  <span className="font-mono text-[0.58rem] text-[var(--text-muted)]">
                    {new Date(sale.createdAt).toLocaleDateString("ru-RU")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="mt-4 text-xs text-[var(--text-muted)]">
          Предметы списываются из последнего снимка инвентаря. Пока мод не
          поддерживает резерв предметов, не выставляй то, чем пользуешься в игре.
        </p>
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
      <div className="mt-1 font-mono text-xl text-[var(--mc-gold)]">{value}</div>
    </div>
  );
}

export const metadata = {
  title: "Маркет",
};
