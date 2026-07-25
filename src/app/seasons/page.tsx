import Link from "next/link";
import { db } from "@/lib/db";
import { seasons, users } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import Header from "@/components/Header";

export default async function SeasonsPage() {
  const session = await auth();
  const allSeasons = db.select().from(seasons).orderBy(desc(seasons.number)).all();

  let user = null;
  if (session?.user?.id) {
    user = db
      .select({ name: users.nickname, skinUrl: users.skinUrl })
      .from(users)
      .where(eq(users.id, parseInt(session.user.id)))
      .get();
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Header
        seasons={allSeasons}
        user={user ? { name: user.name, skinUrl: user.skinUrl } : undefined}
        isLoggedIn={!!session}
      />

      <main className="max-w-6xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-8">Все сезоны</h1>

        {allSeasons.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-[var(--text-muted)] text-lg">Сезоны пока не добавлены.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {allSeasons.map((season) => (
              <Link
                key={season.id}
                href={`/seasons/${season.number}`}
                className="block p-8 bg-[var(--card)] border border-[var(--border)] rounded-lg hover:border-[#7c3aed] transition-all hover:scale-[1.02]"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm text-[#7c3aed] mb-1">
                      Сезон {season.number}
                    </div>
                    <h2 className="text-2xl font-bold mb-3">{season.name}</h2>
                    {season.description && (
                      <p className="text-[var(--text-secondary)]">{season.description}</p>
                    )}
                  </div>
                  {season.isActive && (
                    <span className="px-3 py-1 text-xs bg-green-900 text-green-300 rounded-full">
                      Активный
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
