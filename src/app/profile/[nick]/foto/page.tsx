import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { seasons, users } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import PhotoTab from "@/components/PhotoTab";

/** Вкладка «Фото» профиля: галерея игрока (альбомы, загрузка — владельцу). */
export default async function ProfileFotoPage({
  params,
}: {
  params: Promise<{ nick: string }>;
}) {
  const { nick } = await params;
  const session = await auth();
  const viewerId = session?.user?.id ? parseInt(session.user.id, 10) : null;

  const target = await db.select().from(users).where(eq(users.nickname, nick)).get();
  if (!target) notFound();

  const seasonRows = await db
    .select({ id: seasons.id, number: seasons.number, name: seasons.name })
    .from(seasons)
    .orderBy(desc(seasons.number))
    .all();

  return (
    <PhotoTab
      isOwn={viewerId === target.id}
      ownerUserId={target.id}
      ownerNickname={target.nickname}
      viewerId={viewerId}
      seasons={seasonRows}
    />
  );
}