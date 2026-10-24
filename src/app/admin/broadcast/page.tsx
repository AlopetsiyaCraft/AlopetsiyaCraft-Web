import Link from "next/link";
import { redirect } from "next/navigation";
import { count, desc, eq } from "drizzle-orm";
import { getAdminUser } from "@/lib/admin";
import { db } from "@/lib/db";
import { seasons, users } from "@/lib/db/schema";
import Header from "@/components/Header";
import BroadcastForm from "./BroadcastForm";

/** /admin/broadcast — объявление всем игрокам (сайт, чат, Discord). */
export default async function AdminBroadcastPage() {
  const admin = await getAdminUser();
  if (!admin) {
    redirect(`/auth/login?callbackUrl=${encodeURIComponent("/admin/broadcast")}`);
  }

  const [allSeasons, me, recipients] = await Promise.all([
    db.select().from(seasons).orderBy(desc(seasons.number)).all(),
    db
      .select({ name: users.nickname, skinUrl: users.skinUrl, bld: users.bld })
      .from(users)
      .where(eq(users.id, admin.id))
      .get(),
    db.select({ total: count() }).from(users).get(),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)]">
      <Header
        seasons={allSeasons}
        user={me ? { name: me.name, skinUrl: me.skinUrl, bld: me.bld } : undefined}
        isLoggedIn
      />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="mc-title text-3xl sm:text-4xl">Админка · рассылка</h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Уведомление всем игрокам. При желании — в чат сервера и Discord.
            </p>
          </div>
          <Link href="/admin" className="mc-btn px-3 py-1.5 text-xs">
            ← В админку
          </Link>
        </div>

        <BroadcastForm recipients={recipients?.total ?? 0} />

        <p className="mt-4 text-xs text-[var(--text-muted)]">
          Уведомление появится в колокольчике у каждого игрока. Ссылка должна
          начинаться с «/» — например, /seasons/4 или /market.
        </p>
      </main>
    </div>
  );
}

export const metadata = {
  title: "Админка · рассылка",
};
