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
export default async function GalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ photo?: string; season?: string }>;
}) {
  const sp = await searchParams;
  const session = await auth();
  const seasonRows = await db.select().from(seasons).orderBy(desc(seasons.number)).all();

  const viewer = session?.user?.id
    ? await db
        .select({ id: users.id, name: users.nickname, skinUrl: users.skinUrl, bld: users.bld })
        .from(users)
        .where(eq(users.id, parseInt(session.user.id, 10)))
        .get()
    : null;

  const seasonOptions = seasonRows.map((s) => ({ id: s.id, number: s.number, name: s.name }));
  const seasonId = sp?.season ? parseInt(sp.season, 10) : null;
  const photoId = sp?.photo ? parseInt(sp.photo, 10) : null;

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)]">
      <Header
        seasons={seasonRows}
        user={viewer ? { name: viewer.name, skinUrl: viewer.skinUrl, bld: viewer.bld } : undefined}
        isLoggedIn={!!session}
      />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="mc-title text-3xl sm:text-4xl">Галерея</h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Скриншоты и лучшие моменты сезонов. Комментарии — для зарегистрированных.
            </p>
          </div>
        </div>

        <GalleryFeed
          seasons={seasonOptions}
          isLoggedIn={!!session}
          viewerId={viewer?.id ?? null}
          viewerNickname={viewer?.name ?? null}
          initialSeasonId={seasonId}
          openPhotoId={photoId}
        />
      </main>
    </div>
  );
}

export const metadata = {
  title: "Галерея",
  description: "Общая галерея фото по сезонам",
};