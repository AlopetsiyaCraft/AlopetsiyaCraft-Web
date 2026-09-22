import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, seasons, skinHistory, nameHistory, capeHistory } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import Header from "@/components/Header";
import ProfileSkinViewer from "@/components/ProfileSkinViewer";
import NameHistoryBadge from "@/components/NameHistoryBadge";
import CapeThumbnail from "@/components/CapeThumbnail";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string }>;
}) {
  const params = await searchParams;
  const session = await auth();
  const allSeasons = await db.select().from(seasons).orderBy(desc(seasons.number)).all();

  let viewerUser = null;
  if (session?.user?.id) {
    viewerUser = await db
      .select({ name: users.nickname, skinUrl: users.skinUrl })
      .from(users)
      .where(eq(users.id, parseInt(session.user.id)))
      .get();
  }

  const targetNickname = params.user || viewerUser?.name;

  if (!targetNickname) {
    redirect("/auth/login");
  }

  const profileUser = await db
    .select()
    .from(users)
    .where(eq(users.nickname, targetNickname))
    .get();

  if (!profileUser) {
    notFound();
  }

  const isOwnProfile = session?.user?.id && parseInt(session.user.id) === profileUser.id;

  const skins = await db
    .select()
    .from(skinHistory)
    .where(eq(skinHistory.userId, profileUser.id))
    .orderBy(desc(skinHistory.createdAt))
    .limit(20)
    .all();

  const names = await db
    .select()
    .from(nameHistory)
    .where(eq(nameHistory.userId, profileUser.id))
    .orderBy(desc(nameHistory.createdAt))
    .all();

  const previousNames = names.filter((n) => n.nickname !== profileUser.nickname);

  const capes = await db
    .select()
    .from(capeHistory)
    .where(eq(capeHistory.userId, profileUser.id))
    .orderBy(desc(capeHistory.createdAt))
    .limit(20)
    .all();

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Header
        seasons={allSeasons}
        user={viewerUser ? { name: viewerUser.name, skinUrl: viewerUser.skinUrl } : undefined}
        isLoggedIn={!!session}
      />

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
          <div className="p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row gap-8">
              <div className="flex-shrink-0">
                {profileUser.skinUrl ? (
                  <ProfileSkinViewer skinUrl={profileUser.skinUrl} capeUrl={profileUser.capeUrl} />
                ) : (
                  <div className="w-[300px] h-[300px] bg-[var(--bg)] border border-[var(--border)] rounded-lg flex items-center justify-center">
                    <span className="text-[var(--text-muted)] text-xs">Нет скина</span>
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0 flex flex-col gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h1 className="text-3xl font-bold">{profileUser.nickname}</h1>
                    <NameHistoryBadge names={previousNames} />
                  </div>
                  <p className="text-[var(--text-secondary)] text-sm">
                    Участник с {new Date(profileUser.createdAt).toLocaleDateString("ru-RU")}
                  </p>
                  {isOwnProfile && (
                    <Link
                      href="/profile/settings"
                      className="inline-block mt-3 px-4 py-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm rounded-lg transition-colors"
                    >
                      Изменить внешний вид
                    </Link>
                  )}
                </div>

                <div className="border-t border-[var(--border)] pt-4">
                  <h3 className="text-sm font-semibold text-[var(--text-muted)] mb-2">Учётная запись</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex gap-2">
                      <span className="text-[var(--text-muted)]">UUID:</span>
                      <span className="text-[var(--text-secondary)] font-mono text-xs">
                        {profileUser.mcUuid || "Не привязан"}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-[var(--text-muted)]">Роль:</span>
                      <span className="text-[var(--text-secondary)]">
                        {profileUser.role === "admin" ? "Администратор" : "Игрок"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden mt-4">
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">
              Скины <span className="text-[var(--text-muted)] text-sm font-normal">({skins.length})</span>
            </h2>
            {skins.length === 0 ? (
              <p className="text-[var(--text-muted)] text-sm">Нет загруженных скинов</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {skins.map((skin) => (
                  <div
                    key={skin.id}
                    className="relative group"
                  >
                    <div
                      className="w-12 h-12 rounded relative overflow-hidden border border-[var(--border)]"
                      title={new Date(skin.createdAt).toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" })}
                    >
                      <div
                        className="absolute inset-0"
                        style={{
                          backgroundImage: `url(${skin.skinUrl})`,
                          backgroundSize: "384px 384px",
                          backgroundPosition: "-48px -48px",
                          imageRendering: "pixelated",
                        }}
                      />
                      <div
                        className="absolute inset-0"
                        style={{
                          backgroundImage: `url(${skin.skinUrl})`,
                          backgroundSize: "384px 384px",
                          backgroundPosition: "-240px -48px",
                          imageRendering: "pixelated",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden mt-4">
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">
              Плащи <span className="text-[var(--text-muted)] text-sm font-normal">({capes.length})</span>
            </h2>
            {capes.length === 0 ? (
              <p className="text-[var(--text-muted)] text-sm">Нет плащей</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {capes.map((cape) => (
                  <div
                    key={cape.id}
                    className="relative group"
                  >
                    <div
                      className="rounded relative overflow-hidden border border-[var(--border)]"
                      title={new Date(cape.createdAt).toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" })}
                    >
                      <CapeThumbnail capeUrl={cape.capeUrl} width={30} height={48} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden mt-4">
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">Сезоны</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {allSeasons.map((season) => (
                <Link
                  key={season.id}
                  href={`/seasons/${season.number}`}
                  className="bg-[var(--bg)] border border-[var(--border)] rounded-lg p-4 text-center hover:border-[#7c3aed] transition-colors"
                >
                  <div className="text-[#7c3aed] text-sm mb-1">
                    Сезон {season.number}
                  </div>
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
      </main>
    </div>
  );
}
