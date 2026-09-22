import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { nameHistory, seasons, users } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import Header from "@/components/Header";
import HeadViewer from "@/components/HeadViewer";
import NameHistoryBadge from "@/components/NameHistoryBadge";
import ProfileTabs from "@/components/ProfileTabs";

/**
 * Профиль игрока (VK-стиль, osu-адреса): /profile/<ник> или /profile/<id>.
 * Вкладки: Стена (/), Аудио (/music), Фото (/foto), Друзья (/friends), Внешний вид (/appearance).
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

  const [allSeasons, names] = await Promise.all([
    db.select().from(seasons).orderBy(desc(seasons.number)).all(),
    db
      .select()
      .from(nameHistory)
      .where(eq(nameHistory.userId, target.id))
      .orderBy(desc(nameHistory.createdAt))
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
            <div className="flex items-center gap-6">
              <div className="flex-shrink-0">
                {target.skinUrl ? (
                  <div className="w-24 h-24 rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--bg)]">
                    <HeadViewer skinUrl={target.skinUrl} size={96} />
                  </div>
                ) : (
                  <div className="w-24 h-24 bg-[var(--bg)] border border-[var(--border)] rounded-xl flex items-center justify-center text-[var(--text-muted)] text-xs text-center px-2">
                    Нет скина
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