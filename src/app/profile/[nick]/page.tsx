import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { seasons, skinHistory, users } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import WallFeed from "@/components/WallFeed";
import SkinHistorySection from "@/components/SkinHistorySection";
import { loadPosts } from "@/lib/wall";

/**
 * Вкладка «Стена» профиля: записи пользователя (текст + фото + комментарии).
 * Ниже — история скинов и сезоны (прежние разделы профиля).
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

  const [posts, skins, allSeasons] = await Promise.all([
    loadPosts(target.id),
    db
      .select()
      .from(skinHistory)
      .where(eq(skinHistory.userId, target.id))
      .orderBy(desc(skinHistory.createdAt))
      .limit(20)
      .all(),
    db.select().from(seasons).orderBy(desc(seasons.number)).all(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <WallFeed
        ownerUserId={target.id}
        isOwn={isOwn}
        viewerId={viewerId}
        viewerNickname={me?.name ?? null}
        initialPosts={posts}
      />

      {skins.length > 0 && (
        <SkinHistorySection
          skins={skins.map((s) => ({
            id: s.id,
            skinUrl: s.skinUrl,
            createdAt: s.createdAt.toISOString(),
          }))}
          currentSkinUrl={target.skinUrl}
          model={target.skinModel === "slim" ? "slim" : "default"}
        />
      )}

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">Сезоны</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {allSeasons.map((season) => (
              <Link
                key={season.id}
                href={`/seasons/${season.number}`}
                className="block bg-[var(--bg)] border border-[var(--border)] rounded-lg p-4 hover:border-[#7c3aed]/50 transition-colors"
              >
                <div className="text-sm font-semibold">Сезон {season.number}</div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5 truncate">{season.name}</div>
                {season.isActive && (
                  <span className="inline-block mt-2 px-2 py-0.5 bg-green-500/15 text-green-500 text-[11px] rounded">
                    Активен
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}