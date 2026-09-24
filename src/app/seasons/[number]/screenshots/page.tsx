import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { seasons, users } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import GalleryFeed from "@/components/GalleryFeed";

/**
 * Скриншоты/фото сезона — теперь полноценная галерея (photo-система),
 * загруженные фото обязаны быть привязаны к этому сезону.
 */
export default async function SeasonScreenshotsPage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number } = await params;
  const seasonNumber = parseInt(number);
  if (isNaN(seasonNumber)) notFound();

  const season = await db
    .select()
    .from(seasons)
    .where(eq(seasons.number, seasonNumber))
    .get();
  if (!season) notFound();

  const session = await auth();
  const viewer = session?.user?.id
    ? await db
        .select({ id: users.id, name: users.nickname })
        .from(users)
        .where(eq(users.id, parseInt(session.user.id, 10)))
        .get()
    : null;

  const seasonOptions = await db
    .select({ id: seasons.id, number: seasons.number, name: seasons.name })
    .from(seasons)
    .orderBy(desc(seasons.number))
    .all();

  return (
    <div className="py-8">
      <GalleryFeed
        seasons={seasonOptions}
        isLoggedIn={!!session}
        viewerId={viewer?.id ?? null}
        viewerNickname={viewer?.name ?? null}
        fixedSeasonId={season.id}
      />
    </div>
  );
}