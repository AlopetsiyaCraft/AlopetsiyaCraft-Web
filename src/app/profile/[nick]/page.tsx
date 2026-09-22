import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import WallFeed from "@/components/WallFeed";
import { loadPosts } from "@/lib/wall";

/** Вкладка «Стена» профиля: записи пользователя (текст + фото + комментарии). */
export default async function ProfileWallPage({
  params,
}: {
  params: Promise<{ nick: string }>;
}) {
  const { nick } = await params;
  const session = await auth();
  const viewerId = session?.user?.id ? parseInt(session.user.id, 10) : null;

  const target = await db.select().from(users).where(eq(users.nickname, nick)).get();
  if (!target) notFound();

  const isOwn = viewerId === target.id;
  const me = viewerId
    ? await db.select({ name: users.nickname }).from(users).where(eq(users.id, viewerId)).get()
    : null;

  const posts = await loadPosts(target.id);

  return (
    <div>
      <WallFeed
        ownerUserId={target.id}
        isOwn={isOwn}
        viewerId={viewerId}
        viewerNickname={me?.name ?? null}
        initialPosts={posts}
      />
    </div>
  );
}