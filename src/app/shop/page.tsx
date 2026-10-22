import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { seasons, users } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import Header from "@/components/Header";
import { CHIPS_PER_BLD, DISC_PRICE_BLD } from "@/lib/currency";

/**
 * Магазин АлопецияКрафт (временная витрина, потом переделаем с нуля).
 * Товары выдуманы под валюты: Болды — покупки на сайте, Фишки — казино.
 */
export default async function ShopPage() {
  const session = await auth();
  const allSeasons = await db.select().from(seasons).orderBy(desc(seasons.number)).all();

  let user = null;
  if (session?.user?.id) {
    user = await db
      .select({ name: users.nickname, skinUrl: users.skinUrl, bld: users.bld })
      .from(users)
      .where(eq(users.id, parseInt(session.user.id, 10)))
      .get();
  }

  const items = [
    {
      emoji: "💿",
      title: "Кастомная пластинка",
      desc: "Закажи свою песню в игру: пластинку выдадут в инвентарь на сервере.",
      price: `${DISC_PRICE_BLD} BLD`,
      currency: "bld",
      href: "/music",
      cta: "К музыке",
      ready: true,
    },
    {
      emoji: "🎰",
      title: "Казино-фишки",
      desc: "Фишки для игры за столами: блэкджек, покер и дурак. Обмен в кошельке.",
      price: `1 BLD = ${CHIPS_PER_BLD} фишек`,
      currency: "chips",
      href: "/wallet",
      cta: "В кошелёк",
      ready: true,
    },
    {
      emoji: "🛡",
      title: "Кастомный плащ",
      desc: "Получишь собственный плащ на сервере. Пока не продаётся — готовим.",
      price: "— скоро —",
      currency: "soon",
      href: null,
      cta: "Скоро",
      ready: false,
    },
    {
      emoji: "🏷",
      title: "Ник-эффекты",
      desc: "Цветной ник и рамка в чате сервера. Идея на будущее.",
      price: "— скоро —",
      currency: "soon",
      href: null,
      cta: "Скоро",
      ready: false,
    },
  ];

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
              Покупай за болды (BLD) на сайте, за фишки — в казино на сервере.
            </p>
          </div>
          {user?.bld != null && (
            <span className="mc-panel-flat flex items-center gap-2 px-3 py-2 font-mono text-lg text-[var(--mc-gold)]">
              <span className="text-[0.6rem] uppercase tracking-widest text-[var(--text-muted)]">Баланс</span>
              {user.bld.toLocaleString("ru-RU")} BLD
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <div
              key={item.title}
              className={`mc-panel flex flex-col gap-3 p-5 ${item.ready ? "" : "opacity-75"}`}
            >
              <div className="mc-inset flex h-12 w-12 items-center justify-center text-2xl">
                {item.emoji}
              </div>
              <div>
                <h2 className="text-sm font-bold uppercase tracking-[0.08em]">{item.title}</h2>
                <p className="mt-1.5 text-sm leading-snug text-[var(--text-secondary)]">{item.desc}</p>
              </div>
              <div className="mt-auto border-t-2 border-black/40 pt-3">
                <div className="font-mono text-base text-[var(--mc-gold)]">{item.price}</div>
                {item.href ? (
                  <Link href={item.href} className="mc-btn mc-btn-primary mt-2 w-full py-1.5 text-xs">
                    {item.cta}
                  </Link>
                ) : (
                  <span className="mc-btn mt-2 w-full cursor-not-allowed py-1.5 text-xs opacity-60">
                    {item.cta}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
export const metadata = {
  title: "Магазин",
  description: "Витрина АлопецияКрафт: кастомные пластинки, фишки и будущие плюшки за болды",
};
