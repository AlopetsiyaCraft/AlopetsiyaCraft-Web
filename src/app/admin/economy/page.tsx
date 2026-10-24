import Link from "next/link";
import { redirect } from "next/navigation";
import { count, desc, eq, sql } from "drizzle-orm";
import { getAdminUser } from "@/lib/admin";
import { db } from "@/lib/db";
import { seasons, users } from "@/lib/db/schema";
import Header from "@/components/Header";
import EconomyForm from "./EconomyForm";

/** /admin/economy — масса BLD/фишек, оборот и крупнейшие балансы. */
export default async function AdminEconomyPage() {
  const admin = await getAdminUser();
  if (!admin) {
    redirect(`/auth/login?callbackUrl=${encodeURIComponent("/admin/economy")}`);
  }

  const [allSeasons, me, totals, topHolders] = await Promise.all([
    db.select().from(seasons).orderBy(desc(seasons.number)).all(),
    db
      .select({ name: users.nickname, skinUrl: users.skinUrl, bld: users.bld })
      .from(users)
      .where(eq(users.id, admin.id))
      .get(),
    db
      .select({
        players: count(),
        totalBld: sql<number>`coalesce(sum(${users.bld}), 0)`,
        totalChips: sql<number>`coalesce(sum(${users.chips}), 0)`,
      })
      .from(users)
      .get(),
    db
      .select({ nickname: users.nickname, bld: users.bld, chips: users.chips })
      .from(users)
      .orderBy(desc(users.bld))
      .limit(6)
      .all(),
  ]);

  const players = totals?.players ?? 0;
  const totalBld = totals?.totalBld ?? 0;
  const totalChips = totals?.totalChips ?? 0;

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)]">
      <Header
        seasons={allSeasons}
        user={me ? { name: me.name, skinUrl: me.skinUrl, bld: me.bld } : undefined}
        isLoggedIn
      />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="mc-title text-3xl sm:text-4xl">Админка · экономика</h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Массовые начисления и общая картина по валютам.
            </p>
          </div>
          <Link href="/admin" className="mc-btn px-3 py-1.5 text-xs">
            ← В админку
          </Link>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Игроков" value={players.toLocaleString("ru-RU")} />
          <Stat label="Всего BLD" value={totalBld.toLocaleString("ru-RU")} />
          <Stat
            label="В среднем BLD"
            value={players > 0 ? Math.round(totalBld / players).toLocaleString("ru-RU") : "0"}
          />
          <Stat label="Всего фишек" value={totalChips.toLocaleString("ru-RU")} />
        </div>

        <div className="mb-4">
          <EconomyForm usersCount={players} />
        </div>

        <section className="mc-panel overflow-hidden">
          <div className="mc-head">Крупнейшие балансы</div>
          <ul className="divide-y-2 divide-black/40">
            {topHolders.map((holder) => (
              <li key={holder.nickname} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{holder.nickname}</span>
                <span className="font-mono text-xs text-[var(--mc-gold)]">
                  {holder.bld.toLocaleString("ru-RU")} BLD
                </span>
                <span className="font-mono text-xs text-[var(--mc-green-light)]">
                  {holder.chips.toLocaleString("ru-RU")} фишек
                </span>
              </li>
            ))}
          </ul>
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
      <div className="mt-1 font-mono text-xl text-[var(--mc-gold)]">{value}</div>
    </div>
  );
}

export const metadata = {
  title: "Админка · экономика",
};
