import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { capeHistory, seasons, skinHistory, users } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import ProfileSkinViewer from "@/components/ProfileSkinViewer";
import CapeThumbnail from "@/components/CapeThumbnail";
import SkinHistorySection from "@/components/SkinHistorySection";

/**
 * Вкладка «Внешний вид»: 3D-просмотр скина, история скинов, плащи и сезоны —
 * те разделы, что раньше были на странице профиля целиком.
 */
export default async function ProfileAppearancePage({
  params,
}: {
  params: Promise<{ nick: string }>;
}) {
  const { nick } = await params;
  const session = await auth();
  const target = await db.select().from(users).where(eq(users.nickname, nick)).get();
  if (!target) notFound();

  const isOwn = session?.user?.id ? parseInt(session.user.id, 10) === target.id : false;

  const [skins, capes, allSeasons] = await Promise.all([
    db
      .select()
      .from(skinHistory)
      .where(eq(skinHistory.userId, target.id))
      .orderBy(desc(skinHistory.createdAt))
      .limit(20)
      .all(),
    db
      .select()
      .from(capeHistory)
      .where(eq(capeHistory.userId, target.id))
      .orderBy(desc(capeHistory.createdAt))
      .limit(20)
      .all(),
    db.select().from(seasons).orderBy(desc(seasons.number)).all(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
        <div className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row gap-8">
            <div className="flex-shrink-0">
              {target.skinUrl ? (
                <ProfileSkinViewer
                  skinUrl={target.skinUrl}
                  capeUrl={target.capeUrl}
                  model={target.skinModel === "slim" ? "slim" : "default"}
                />
              ) : (
                <div className="w-[300px] h-[300px] bg-[var(--bg)] border border-[var(--border)] rounded-lg flex items-center justify-center">
                  <span className="text-[var(--text-muted)] text-xs">Нет скина</span>
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold mb-1">Внешний вид: {target.nickname}</h1>
              <p className="text-[var(--text-secondary)] text-sm">
                Скин, плащи и история изменений внешнего вида.
              </p>
              {isOwn && (
                <Link
                  href="/profile/settings"
                  className="inline-block mt-3 px-4 py-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm rounded-lg transition-colors"
                >
                  Изменить внешний вид
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      <SkinHistorySection
        skins={skins.map((s) => ({
          id: s.id,
          skinUrl: s.skinUrl,
          createdAt: s.createdAt.toISOString(),
        }))}
        currentSkinUrl={target.skinUrl}
        model={target.skinModel === "slim" ? "slim" : "default"}
      />

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">
            Плащи <span className="text-[var(--text-muted)] text-sm font-normal">({capes.length})</span>
          </h2>
          {capes.length === 0 ? (
            <p className="text-[var(--text-muted)] text-sm">Нет плащей</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {capes.map((cape) => (
                <div key={cape.id} className="relative group">
                  <div
                    className="rounded relative overflow-hidden border border-[var(--border)]"
                    title={new Date(cape.createdAt).toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" })}
                  >
                    <CapeThumbnail capeUrl={cape.capeUrl} width={30} height={48} />
                  </div>
                  <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 whitespace-nowrap rounded bg-black text-white text-[11px] px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-lg">
                    {new Date(cape.createdAt).toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">Сезоны</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {allSeasons.map((season) => (
              <Link
                key={season.id}
                href={`/seasons/${season.number}`}
                className="bg-[var(--bg)] border border-[var(--border)] rounded-lg p-4 text-center hover:border-[#7c3aed] transition-colors"
              >
                <div className="text-[#7c3aed] text-sm mb-1">Сезон {season.number}</div>
                <div className="font-medium text-sm">{season.name}</div>
                {season.isActive && (
                  <span className="inline-block mt-2 text-xs px-2 py-0.5 bg-green-900 text-green-300 rounded-full">
                    Активный
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