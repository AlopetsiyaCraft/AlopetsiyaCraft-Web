import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { nameHistory, seasons, userFrames, users } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import Header from "@/components/Header";
import HeadViewer from "@/components/HeadViewer";
import NameHistoryBadge from "@/components/NameHistoryBadge";
import ProfileTabs from "@/components/ProfileTabs";
import {
  SOCIAL_KEYS,
  SOCIAL_LABELS,
  nickColorValue,
  parseSocials,
  profileBackgroundStyle,
  profileFrameStyle,
  socialHref,
} from "@/lib/profileCustomization";

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
    .select({ id: users.id, name: users.nickname, skinUrl: users.skinUrl, bld: users.bld })
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

  const [allSeasons, names, frames] = await Promise.all([
    db.select().from(seasons).orderBy(desc(seasons.number)).all(),
    db
      .select()
      .from(nameHistory)
      .where(eq(nameHistory.userId, target.id))
      .orderBy(desc(nameHistory.createdAt))
      .all(),
    db
      .select({ frameId: userFrames.frameId })
      .from(userFrames)
      .where(eq(userFrames.userId, target.id))
      .all(),
  ]);

  const seenNames = new Set<string>();
  const previousNames = names.filter((n) => {
    const key = n.nickname.toLowerCase();
    if (key === target.nickname.toLowerCase() || seenNames.has(key)) return false;
    seenNames.add(key);
    return true;
  });
  const isOwn = target.id === me.id;
  const socials = parseSocials(target.socials);
  const nickColor = nickColorValue(target.nickColor);
  const unlockedFrameIds = new Set(frames.map((f) => f.frameId));
  const activeFrame =
    target.profileFrame && unlockedFrameIds.has(target.profileFrame)
      ? target.profileFrame
      : null;
  const backgroundStyle = target.profileBgImage
    ? {
        backgroundImage: `url("${target.profileBgImage}")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : profileBackgroundStyle(target.profileBg);
  const hasCustomBackground =
    !!target.profileBgImage || Object.keys(backgroundStyle).length > 0;
  const frameStyle = profileFrameStyle(activeFrame);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)]">
      <Header
        seasons={allSeasons}
        user={{ name: me.name, skinUrl: me.skinUrl, bld: me.bld }}
        isLoggedIn={!!session}
      />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 py-8">
        <div className="mc-panel overflow-hidden">
          {/* Пиксельный баннер */}
          <div
            className={`h-28 border-b-2 border-black sm:h-40 ${
              hasCustomBackground ? "" : "mc-hero-bg"
            }`}
            style={backgroundStyle}
          />

          <div className="px-4 pb-5 sm:px-6">
            <div className="-mt-12 flex flex-col gap-4 sm:-mt-14 sm:flex-row sm:items-end">
              <div className="shrink-0">
                {target.skinUrl ? (
                  <div
                    className="h-24 w-24 overflow-hidden border-2 border-black bg-[var(--bg)] shadow-[3px_3px_0_rgba(0,0,0,.55)] sm:h-28 sm:w-28"
                    style={frameStyle}
                  >
                    <HeadViewer skinUrl={target.skinUrl} size={112} />
                  </div>
                ) : (
                  <div
                    className="flex h-24 w-24 items-center justify-center border-2 border-black bg-[var(--bg-alt)] px-1 text-center text-[0.65rem] text-[var(--text-muted)] shadow-[3px_3px_0_rgba(0,0,0,.55)] sm:h-28 sm:w-28"
                    style={frameStyle}
                  >
                    Нет скина
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1 sm:pb-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <h1
                    className="mc-title text-2xl sm:text-3xl"
                    style={nickColor ? { color: nickColor } : undefined}
                  >
                    {target.nickname}
                  </h1>
                  <NameHistoryBadge names={previousNames} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mc-chip text-[0.6rem] text-[var(--mc-green-light)]">
                    {target.role === "admin" ? "Администратор" : "Игрок"}
                  </span>
                  <span className="mc-chip text-[0.6rem] text-[var(--text-secondary)]">
                    с {new Date(target.createdAt).toLocaleDateString("ru-RU")}
                  </span>
                  {target.bld != null && (
                    <span className="mc-chip font-mono text-[0.6rem] text-[var(--mc-gold)]">
                      {target.bld.toLocaleString("ru-RU")} BLD
                    </span>
                  )}
                </div>
                {target.status && (
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">{target.status}</p>
                )}
                {Object.keys(socials).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {SOCIAL_KEYS.map((key) => {
                      const value = socials[key];
                      if (!value) return null;
                      const href = socialHref(key, value);
                      const label = SOCIAL_LABELS[key];
                      return href ? (
                        <a
                          key={key}
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mc-chip text-[0.6rem] text-[var(--mc-green-light)] hover:bg-[var(--hover)]"
                        >
                          {label}
                        </a>
                      ) : (
                        <span
                          key={key}
                          className="mc-chip text-[0.6rem] text-[var(--text-secondary)]"
                        >
                          {label}: {value}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              {isOwn && (
                <Link href="/profile/settings" className="mc-btn mc-btn-primary self-start py-1.5 text-xs sm:self-end">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24">
                    <path strokeLinecap="square" d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
                  </svg>
                  Изменить профиль
                </Link>
              )}
            </div>
          </div>
        </div>

        <ProfileTabs baseHref={`/profile/${encodeURIComponent(target.nickname)}`} />

        {children}
      </main>
    </div>
  );
}