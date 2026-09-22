import Link from "next/link";
import { db } from "@/lib/db";
import { seasons, users } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import Header from "@/components/Header";

export default async function SeasonLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ number: string }>;
}) {
  const { number } = await params;
  const seasonNumber = parseInt(number);

  if (isNaN(seasonNumber)) {
    notFound();
  }

  const season = await db
    .select()
    .from(seasons)
    .where(eq(seasons.number, seasonNumber))
    .get();

  if (!season) {
    notFound();
  }

  const allSeasons = await db.select().from(seasons).orderBy(desc(seasons.number)).all();

  const session = await auth();
  let user = null;
  if (session?.user?.id) {
    user = await db
      .select({ name: users.nickname, skinUrl: users.skinUrl })
      .from(users)
      .where(eq(users.id, parseInt(session.user.id)))
      .get();
  }

  const tabs = [
    { name: "Карта", href: `/seasons/${seasonNumber}/map` },
    { name: "Фото", href: `/seasons/${seasonNumber}/screenshots` },
    { name: "Чат", href: `/seasons/${seasonNumber}/chat` },
    { name: "Сборка", href: `/seasons/${seasonNumber}/build` },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Header
        seasons={allSeasons}
        user={user ? { name: user.name, skinUrl: user.skinUrl } : undefined}
        isLoggedIn={!!session}
      />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="text-sm text-[#7c3aed] mb-1">Сезон {season.number}</div>
          <h1 className="text-3xl font-bold">{season.name}</h1>
          {season.description && (
            <p className="text-[var(--text-secondary)] mt-2">{season.description}</p>
          )}
        </div>

        <nav className="flex gap-1 border-b border-[var(--border)] mb-8">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className="px-6 py-3 text-[var(--text-muted)] hover:text-[var(--text)] hover:border-b-2 hover:border-[#7c3aed] transition-colors"
            >
              {tab.name}
            </Link>
          ))}
        </nav>

        {children}
      </main>
    </div>
  );
}
