import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import MyAudio from "@/components/MyAudio";

/** Вкладка «Аудио» профиля: своя библиотека с загрузкой, чужая — для прослушивания. */
export default async function ProfileMusicPage({
  params,
}: {
  params: Promise<{ nick: string }>;
}) {
  const { nick } = await params;
  const session = await auth();
  const viewerId = session?.user?.id ? parseInt(session.user.id, 10) : null;

  const target = await db.select().from(users).where(eq(users.nickname, nick)).get();
  if (!target) notFound();

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline gap-2">
        <h2 className="mc-title text-2xl">Аудио</h2>
        <span className="font-mono text-sm text-[var(--mc-green-light)]">{target.nickname}</span>
      </div>
      <MyAudio isOwn={viewerId === target.id} targetNickname={target.nickname} />
    </div>
  );
}