import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, seasons } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import Header from "@/components/Header";
import MyAudio from "@/components/MyAudio";

export const metadata: Metadata = {
  title: "Мои аудио — АлопецияКрафт",
  description: "Личная библиотека аудио и создание пластинок",
};

export default async function MusicPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string }>;
}) {
  const params = await searchParams;
  const session = await auth();
  const allSeasons = await db.select().from(seasons).orderBy(desc(seasons.number)).all();

  if (!session?.user?.id) {
    redirect("/auth/login");
  }

  const viewer = await db
    .select({ name: users.nickname, skinUrl: users.skinUrl })
    .from(users)
    .where(eq(users.id, parseInt(session.user.id, 10)))
    .limit(1)
    .get();

  if (!viewer) {
    redirect("/auth/login");
  }

  const targetNickname = params.user?.trim() || viewer.name;
  const isOwn = targetNickname === viewer.name;

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Header
        seasons={allSeasons}
        user={viewer}
        isLoggedIn={!!session}
      />

      <main className="max-w-3xl mx-auto px-4 py-8">
        <MyAudio isOwn={isOwn} targetNickname={targetNickname} />
      </main>
    </div>
  );
}