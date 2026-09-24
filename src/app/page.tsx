import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { seasons, users } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import Header from "@/components/Header";
import LiveChat from "@/components/LiveChat";
import PlayersOnline from "@/components/PlayersOnline";
import BlueMapSection from "@/components/BlueMapSection";

export default async function Home() {
  const session = await auth();
  const allSeasons = await db.select().from(seasons).orderBy(desc(seasons.number)).all();

  let user = null;
  if (session?.user?.id) {
    user = await db
      .select({ name: users.nickname, skinUrl: users.skinUrl })
      .from(users)
      .where(eq(users.id, parseInt(session.user.id)))
      .get();
  }

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg)]">
      <Header
        seasons={allSeasons}
        user={user ? { name: user.name, skinUrl: user.skinUrl } : undefined}
        isLoggedIn={!!session}
      />

      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <LiveChat isLoggedIn={!!session} />
            </div>
            <div>
              <PlayersOnline />
            </div>
          </div>

          <BlueMapSection />
        </div>
      </main>

      <footer className="border-t border-[var(--border)] py-6 px-4">
        <div className="max-w-7xl mx-auto text-center text-[var(--text-muted)] text-sm">
          © 2024 АлопецияКрафт. Minecraft не принадлежит Mojang AB.
        </div>
      </footer>
    </div>
  );
}
