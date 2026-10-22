import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { achievements, users } from "@/lib/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
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
import { parseFeaturedAchievements } from "@/lib/profileCustomization";

const FRAME_COLORS: Record<string, string> = {
  task: "var(--mc-green-light)",
  goal: "var(--mc-gold)",
  challenge: "#a855f7",
};

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

  const featuredIds = parseFeaturedAchievements(target.featuredAchievements);
  const achievementFields = {
    id: achievements.id,
    title: achievements.title,
    description: achievements.description,
    frame: achievements.frame,
    createdAt: achievements.createdAt,
  };
  const featured =
    featuredIds.length > 0
      ? (
          await db
            .select(achievementFields)
            .from(achievements)
            .where(
              and(
                eq(achievements.nickname, target.nickname),
                inArray(achievements.id, featuredIds)
              )
            )
            .all()
        ).sort((a, b) => featuredIds.indexOf(a.id) - featuredIds.indexOf(b.id))
      : await db
          .select(achievementFields)
          .from(achievements)
          .where(eq(achievements.nickname, target.nickname))
          .orderBy(desc(achievements.createdAt))
          .limit(3)
          .all();

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        {featured.length > 0 && (
          <section className="mc-panel overflow-hidden">
            <div className="mc-head">
              Витрина достижений
              <span className="ml-auto text-[0.58rem] font-normal normal-case tracking-normal text-[var(--text-muted)]">
                {featuredIds.length > 0 ? "закреплено" : "последние"}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-px bg-black/50 sm:grid-cols-3">
              {featured.map((achievement) => (
                <div
                  key={achievement.id}
                  className="flex flex-col gap-1.5 bg-[var(--card)] p-3"
                >
                  <div className="flex items-start gap-2">
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center border-2 border-black text-sm"
                      style={{
                        color: FRAME_COLORS[achievement.frame] ?? "var(--mc-green-light)",
                      }}
                      aria-hidden
                    >
                      ★
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold leading-tight">
                        {achievement.title}
                      </div>
                      {achievement.description && (
                        <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-[var(--text-muted)]">
                          {achievement.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="mt-auto font-mono text-[0.56rem] text-[var(--text-muted)]">
                    {new Date(achievement.createdAt).toLocaleDateString("ru-RU")}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

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