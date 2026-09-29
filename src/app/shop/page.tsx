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
    <div className="min-h-screen bg-[var(--bg)]">
      <Header
        seasons={allSeasons}
        user={user ? { name: user.name, skinUrl: user.skinUrl, bld: user.bld } : undefined}
        isLoggedIn={!!session}
      />

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Магазин</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            Покупай за болды (BLD) — на сайте, за фишки — в казино на сервере.
            Витрина временная, скоро переделаем.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {items.map((item) => (
            <div
              key={item.title}
              className={`bg-[var(--card)] border border-[var(--border)] rounded-lg p-5 flex flex-col gap-3 ${item.ready ? "" : "opacity-70"}`}
            >
              <div className="text-3xl">{item.emoji}</div>
              <div>
                <h2 className="font-bold">{item.title}</h2>
                <p className="text-sm text-[var(--text-muted)] mt-1">{item.desc}</p>
              </div>
              <div className="mt-auto pt-2">
                <div className="text-sm font-semibold text-emerald-500">{item.price}</div>
                {item.href ? (
                  <Link
                    href={item.href}
                    className="mt-2 inline-block px-3 py-1.5 rounded-lg bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs font-medium transition-colors"
                  >
                    {item.cta}
                  </Link>
                ) : (
                  <span className="mt-2 inline-block px-3 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text-muted)]">
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