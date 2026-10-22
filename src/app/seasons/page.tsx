import Link from "next/link";
import { db } from "@/lib/db";
import { seasons, users } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import Header from "@/components/Header";

export default async function SeasonsPage() {
  const session = await auth();
  const allSeasons = await db.select().from(seasons).orderBy(desc(seasons.number)).all();

  let user = null;
  if (session?.user?.id) {
    user = await db
      .select({ name: users.nickname, skinUrl: users.skinUrl, bld: users.bld })
      .from(users)
      .where(eq(users.id, parseInt(session.user.id)))
      .get();
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)]">
      <Header
        seasons={allSeasons}
        user={user ? { name: user.name, skinUrl: user.skinUrl, bld: user.bld } : undefined}
        isLoggedIn={!!session}
      />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <h1 className="mc-title text-3xl sm:text-4xl">Все сезоны</h1>
          <span className="mc-chip text-[0.65rem] text-[var(--text-secondary)]">
            Всего: {allSeasons.length}
          </span>
        </div>

        {allSeasons.length === 0 ? (
          <div className="mc-inset px-6 py-16 text-center">
            <p className="text-sm text-[var(--text-muted)]">Сезоны пока не добавлены.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {allSeasons.map((season) => (
              <Link key={season.id} href={`/seasons/${season.number}`} className="mc-panel group block overflow-hidden">
                <div className={`h-2 ${season.isActive ? "bg-[var(--mc-green)]" : "bg-[var(--border-soft)]"}`} />
                <div className="flex items-start justify-between gap-3 p-6">
                  <div>
                    <div className="mb-1 font-mono text-xs uppercase tracking-[0.2em] text-[var(--mc-green-light)]">
                      Сезон {season.number}
                    </div>
                    <h2 className="text-xl font-bold transition-colors group-hover:text-[var(--mc-green-light)] sm:text-2xl">
                      {season.name}
                    </h2>
                  </div>
                  {season.isActive ? (
                    <span className="mc-chip shrink-0 text-[0.6rem] text-[var(--mc-green-light)]">
                      Активный
                    </span>
                  ) : (
                    <span className="mc-chip shrink-0 text-[0.6rem] text-[var(--text-muted)]">
                      Архив
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export const metadata = {
  title: "Сезоны",
  description: "Все сезоны Minecraft-сервера АлопецияКрафт",
};
