import { redirect } from "next/navigation";
import Link from "next/link";
import { count, desc, eq } from "drizzle-orm";
import { getAdminUser } from "@/lib/admin";
import { db } from "@/lib/db";
import { seasons, shopOrders, shopProducts, users } from "@/lib/db/schema";
import Header from "@/components/Header";
import AdminBalances from "@/components/AdminBalances";

/** /admin — сводка и вход в разделы. Доступ только у администратора. */
export default async function AdminPage() {
  const admin = await getAdminUser();
  if (!admin) {
    redirect(`/auth/login?callbackUrl=${encodeURIComponent("/admin")}`);
  }

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
        isLoggedIn
      />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
        <div>
          <h1 className="mc-title text-3xl sm:text-4xl">Админка</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Экономика, игроки, магазин и сезоны.
          </p>
          <span className="mc-chip mt-2 inline-flex text-[0.58rem] text-[var(--mc-green-light)]">
            Администратор
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Игроков", value: usersCount?.total ?? 0, href: "/admin/users" },
            { label: "Товаров", value: productsCount?.total ?? 0, href: "/admin/shop" },
            { label: "Ждут выдачи", value: pendingCount?.total ?? 0, href: "/admin/shop" },
            { label: "Мой BLD", value: me?.bld ?? 0, href: "/wallet" },
          ].map((stat) => (
            <Link
              key={stat.label}
              href={stat.href}
              className="mc-panel block p-4 transition-colors hover:bg-[var(--hover)]"
            >
              <div className="text-[0.58rem] uppercase tracking-[0.14em] text-[var(--text-muted)]">
                {stat.label}
              </div>
              <div className="mt-1 font-mono text-2xl text-[var(--mc-gold)]">
                {stat.value}
              </div>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <AdminLink
            href="/admin/users"
            icon="👥"
            title="Игроки"
            text="Права администратора и балансы аккаунтов."
          />
          <AdminLink
            href="/admin/analytics"
            icon="📊"
            title="Аналитика"
            text="Просмотры разделов и мёртвые страницы."
          />
          <AdminLink
            href="/admin/economy"
            icon="💰"
            title="Экономика"
            text="Массовые начисления BLD и фишек, оборот валют."
          />
          <AdminLink
            href="/admin/broadcast"
            icon="📢"
            title="Рассылка"
            text="Объявление всем игрокам: сайт, чат и Discord."
          />
          <AdminLink
            href="/admin/audit"
            icon="📜"
            title="Аудит"
            text="История действий администратора."
          />
          <AdminLink
            href="/admin/content"
            icon="✏️"
            title="Контент"
            text="Подписи и видимость фото, текст записей стены."
          />
          <AdminLink
            href="/admin/seasons"
            icon="🗓"
            title="Сезоны"
            text="Создание, редактирование и активация сезонов."
          />
          <AdminLink
            href="/admin/shop"
            icon="🛒"
            title="Магазин"
            text="Каталог, цены, лимиты и ручная выдача заказов."
          />
          <AdminLink
            href="/inventory"
            icon="🎒"
            title="Инвентарь"
            text="Просмотр и откат инвентаря игроков."
          />
        </div>

        <AdminBalances />
      </main>
    </div>
  );
}

function AdminLink({
  href,
  icon,
  title,
  text,
}: {
  href: string;
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <Link
      href={href}
      className="mc-panel flex flex-col gap-2 p-5 transition-transform hover:-translate-y-0.5"
    >
      <span className="text-lg">{icon}</span>
      <span className="text-sm font-bold uppercase tracking-[0.08em]">{title}</span>
      <span className="text-sm text-[var(--text-secondary)]">{text}</span>
    </Link>
  );
}

export const metadata = {
  title: "Админка",
  description: "Экономика, игроки, магазин и сезоны АлопецияКрафт",
};
