import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { capeHistory, nameHistory, seasons, users } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import Header from "@/components/Header";
import ProfileSkinViewer from "@/components/ProfileSkinViewer";
import NameHistoryBadge from "@/components/NameHistoryBadge";
import CapeThumbnail from "@/components/CapeThumbnail";
import ProfileTabs from "@/components/ProfileTabs";

/**
 * Профиль игрока (VK-стиль, osu-адреса): /profile/<ник> или /profile/<id>.
 * Вкладки: Стена (/), Аудио (/music), Фото (/foto), Друзья (/friends).
 * Профиль видят только зарегистрированные.
 */
export default async function ProfileLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ nick: string }>;
}) {
  const { nick } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/auth/login?callbackUrl=${encodeURIComponent(`/profile/${encodeURIComponent(nick)}`)}`);
  }

  const me = await db
    .select({ id: users.id, name: users.nickname, skinUrl: users.skinUrl })
    .from(users)
    .where(eq(users.id, parseInt(session.user.id, 10)))
    .get();
  if (!me) redirect("/auth/login");

  // /profile/friends из шапки → своя вкладка «Друзья»
  if (nick === "friends") redirect(`/profile/${encodeURIComponent(me.name)}/friends`);

  let target = await db.select().from(users).where(eq(users.nickname, nick)).get();
  if (!target && /^\d+$/.test(nick)) {
    target = await db.select().from(users).where(eq(users.id, parseInt(nick, 10))).get();
    if (target) redirect(`/profile/${encodeURIComponent(target.nickname)}`);
  }
  if (!target) notFound();

  const [allSeasons, names, capes] = await Promise.all([
    db.select().from(seasons).orderBy(desc(seasons.number)).all(),
    db
      .select()
      .from(nameHistory)
      .where(eq(nameHistory.userId, target.id))
      .orderBy(desc(nameHistory.createdAt))
      .all(),
    db
      .select()
      .from(capeHistory)
      .where(eq(capeHistory.userId, target.id))
      .orderBy(desc(capeHistory.createdAt))
      .limit(20)
      .all(),
  ]);

  const previousNames = names.filter((n) => n.nickname !== target.nickname);
  const isOwn = target.id === me.id;

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Header
        seasons={allSeasons}
        user={{ name: me.name, skinUrl: me.skinUrl }}
        isLoggedIn={!!session}
      />

      <main className="max-w-5xl mx-auto px-4 py-8 flex flex-col gap-6">
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

              <div className="flex-1 min-w-0 flex flex-col gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h1 className="text-3xl font-bold">{target.nickname}</h1>
                    <NameHistoryBadge names={previousNames} />
                  </div>
                  <p className="text-[var(--text-secondary)] text-sm">
                    Участник с {new Date(target.createdAt).toLocaleDateString("ru-RU")}
                  </p>
                  <p className="text-[var(--text-secondary)] text-sm">
                    Роль: {target.role === "admin" ? "Администратор" : "Игрок"}
                  </p>
                  {isOwn && (
                    <Link
                      href="/profile/settings"
                      className="inline-block mt-3 px-4 py-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm rounded-lg transition-colors"
                    >
                      Изменить профиль
                    </Link>
                  )}
                </div>

                {capes.length > 0 && (
                  <div className="border-t border-[var(--border)] pt-4">
                    <h3 className="text-sm font-semibold text-[var(--text-muted)] mb-2">
                      Плащи <span className="font-normal">({capes.length})</span>
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {capes.map((cape) => (
                        <div key={cape.id} className="rounded overflow-hidden border border-[var(--border)]">
                          <CapeThumbnail capeUrl={cape.capeUrl} width={30} height={48} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <ProfileTabs baseHref={`/profile/${encodeURIComponent(target.nickname)}`} />

        {children}
      </main>
    </div>
  );
}