import { redirect } from "next/navigation";
import Link from "next/link";
import { count, desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getAdminUser } from "@/lib/admin";
import { db } from "@/lib/db";
import { seasons, shopOrders, shopProducts, users } from "@/lib/db/schema";
import Header from "@/components/Header";
import AdminBalances from "@/components/AdminBalances";

/** /admin — простая админ-панель: сводка, балансы и вход в управление магазином. */
export default async function AdminPage() {
  const admin = await getAdminUser();
  if (!admin) {
    redirect(`/auth/login?callbackUrl=${encodeURIComponent("/admin")}`);
  }

  const session = await auth();
  const [allSeasons, me, usersCount, productsCount, pendingCount] = await Promise.all([
    db.select().from(seasons).orderBy(desc(seasons.number)).all(),
    db
      .select({ name: users.nickname, skinUrl: users.skinUrl, bld: users.bld })
      .from(users)
      .where(eq(users.id, admin.id))
      .get(),
    db.select({ total: count() }).from(users).get(),
    db.select({ total: count() }).from(shopProducts).get(),
    db
      .select({ total: count() })
      .from(shopOrders)
      .where(eq(shopOrders.status, "pending"))
      .get(),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)]">
      <Header
        seasons={allSeasons}
        user={me ? { name: me.name, skinUrl: me.skinUrl, bld: me.bld } : undefined}
        isLoggedIn={!!session}
      />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
        <div>
          <h1 className="mc-title text-3xl sm:text-4xl">Админка</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Экономика, магазин и заказы. Доступно только администраторам.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Игроков", value: usersCount?.total ?? 0, href: "/stats" },
            { label: "Товаров", value: productsCount?.total ?? 0, href: "/admin/shop" },
            { label: "Ждут выдачи", value: pendingCount?.total ?? 0, href: "/admin/shop" },
            { label: "Мой BLD", value: me?.bld ?? 0, href: "/wallet" },
          ].map((stat) => (
            <Link key={stat.label} href={stat.href} className="mc-panel block p-4 transition-colors hover:bg-[var(--hover)]">
              <div className="text-[0.58rem] uppercase tracking-[0.14em] text-[var(--text-muted)]">
                {stat.label}
              </div>
              <div className="mt-1 font-mono text-2xl text-[var(--mc-gold)]">{stat.value}</div>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Link href="/admin/shop" className="mc-panel flex flex-col gap-2 p-5 transition-transform hover:-translate-y-0.5">
            <span className="text-lg">🛒</span>
            <span className="text-sm font-bold uppercase tracking-[0.08em]">Магазин</span>
            <span className="text-sm text-[var(--text-secondary)]">
              Каталог, цены, лимиты и ручная выдача заказов.
            </span>
          </Link>
          <Link href="/inventory" className="mc-panel flex flex-col gap-2 p-5 transition-transform hover:-translate-y-0.5">
            <span className="text-lg">🎒</span>
            <span className="text-sm font-bold uppercase tracking-[0.08em]">Инвентарь</span>
            <span className="text-sm text-[var(--text-secondary)]">
              Просмотр и откат инвентаря игроков.
            </span>
          </Link>
        </div>

        <AdminBalances />
      </main>
    </div>
  );
}

export const metadata = {
  title: "Админка",
  description: "Экономика, магазин и заказы АлопецияКрафт",
};
