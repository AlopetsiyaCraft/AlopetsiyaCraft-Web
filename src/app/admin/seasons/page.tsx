import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { getAdminUser } from "@/lib/admin";
import { db } from "@/lib/db";
import { seasons, users } from "@/lib/db/schema";
import Header from "@/components/Header";
import AdminSeasons, { type AdminSeason } from "@/components/AdminSeasons";

/** /admin/seasons — создание, редактирование и активация сезонов. */
export default async function AdminSeasonsPage() {
  const admin = await getAdminUser();
  if (!admin) {
    redirect(`/auth/login?callbackUrl=${encodeURIComponent("/admin/seasons")}`);
  }

  const [allSeasons, me] = await Promise.all([
    db.select().from(seasons).orderBy(desc(seasons.number)).all(),
    db
      .select({ name: users.nickname, skinUrl: users.skinUrl, bld: users.bld })
      .from(users)
      .where(eq(users.id, admin.id))
      .get(),
  ]);

  const rows: AdminSeason[] = allSeasons.map((season) => ({
    id: season.id,
    number: season.number,
    name: season.name,
    description: season.description,
    modpackUrl: season.modpackUrl,
    isActive: season.isActive,
  }));

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)]">
      <Header
        seasons={allSeasons}
        user={me ? { name: me.name, skinUrl: me.skinUrl, bld: me.bld } : undefined}
        isLoggedIn
      />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="mc-title text-3xl sm:text-4xl">Админка · сезоны</h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Активный сезон показывается на главной и в шапке.
            </p>
          </div>
          <a href="/admin" className="mc-btn px-3 py-1.5 text-xs">
            ← В админку
          </a>
        </div>
        <AdminSeasons initialSeasons={rows} />
      </main>
    </div>
  );
}

export const metadata = {
  title: "Админка · сезоны",
};
