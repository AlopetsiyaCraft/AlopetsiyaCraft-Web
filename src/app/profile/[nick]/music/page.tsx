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
      <h1 className="text-2xl font-bold mb-4">
        Аудио: <span className="text-[#7c3aed]">{target.nickname}</span>
      </h1>
      <MyAudio isOwn={viewerId === target.id} targetNickname={target.nickname} />
    </div>
  );
}