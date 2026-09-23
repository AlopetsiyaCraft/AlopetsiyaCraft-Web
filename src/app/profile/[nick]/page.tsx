import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import WallFeed from "@/components/WallFeed";
import WallSidebar from "@/components/WallSidebar";
import { loadPosts } from "@/lib/wall";
import {
  countAudio,
  countFriends,
  countPhotos,
  loadAudioPreview,
  loadFriendPreview,
  loadPhotoPreview,
} from "@/lib/wallPreview";

/**
 * Главная страница профиля — стена (VK-стиль):
 * слева лента записей, справа блоки-превью «Аудио» (5), «Фото» (6) и «Друзья» (6).
 * Блоки скрываются, если контента нет. Вкладки остаются во всех профилях.
 */
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

  const baseHref = `/profile/${encodeURIComponent(target.nickname)}`;

  const [posts, tracks, previewPhotos, friends, audioTotal, photoTotal, friendTotal] = await Promise.all([
    loadPosts(target.id),
    loadAudioPreview(target.id),
    loadPhotoPreview(target.id),
    loadFriendPreview(target.id),
    countAudio(target.id),
    countPhotos(target.id),
    countFriends(target.id),
  ]);

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="flex-1 min-w-0">
        <WallFeed
          ownerUserId={target.id}
          isOwn={isOwn}
          viewerId={viewerId}
          viewerNickname={me?.name ?? null}
          initialPosts={posts}
        />
      </div>
      <WallSidebar
        baseHref={baseHref}
        tracks={tracks}
        audioTotal={audioTotal}
        photos={previewPhotos}
        photoTotal={photoTotal}
        friends={friends}
        friendTotal={friendTotal}
      />
    </div>
  );
}