import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { seasons, users } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import Header from "@/components/Header";
import GalleryFeed from "@/components/GalleryFeed";

/**
 * Общая галерея фото по сезонам. Открыта всем (в т.ч. без входа):
 * анонимам видны только фото «для всех», комментарии скрыты.
 */
export default async function GalleryPage() {
  const session = await auth();
  const seasonRows = await db.select().from(seasons).orderBy(desc(seasons.number)).all();

  const viewer = session?.user?.id
    ? await db
        .select({ id: users.id, name: users.nickname, skinUrl: users.skinUrl })
        .from(users)
        .where(eq(users.id, parseInt(session.user.id, 10)))
        .get()
    : null;

  const seasonOptions = seasonRows.map((s) => ({ id: s.id, number: s.number, name: s.name }));

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Header
        seasons={seasonRows}
        user={viewer ? { name: viewer.name, skinUrl: viewer.skinUrl } : undefined}
        isLoggedIn={!!session}
      />

      <main className="max-w-5xl mx-auto px-4 py-8 flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold">Галерея</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            Фото сервера по сезонам. Галерея открыта всем, комментарии — только зарегистрированным.
          </p>
        </div>

        <GalleryFeed
          seasons={seasonOptions}
          isLoggedIn={!!session}
          viewerId={viewer?.id ?? null}
          viewerNickname={viewer?.name ?? null}
        />
      </main>
    </div>
  );
}

export const metadata = {
  title: "Галерея — АлопецияКрафт",
  description: "Общая галерея фото по сезонам",
};