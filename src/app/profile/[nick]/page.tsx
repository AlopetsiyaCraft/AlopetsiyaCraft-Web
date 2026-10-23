import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  achievements,
  playerStats,
  seasons,
  users,
} from "@/lib/db/schema";
import PlayerHead from "@/components/mc/PlayerHead";
import ProfileRadar from "@/components/profile/ProfileRadar";
import {
  STAT_CATEGORIES,
  formatStatValue,
  getStatCategory,
} from "@/lib/stats";
import {
  countAudio,
  countFriends,
  countPhotos,
  loadAudioPreview,
  loadFriendPreview,
  loadPhotoPreview,
} from "@/lib/wallPreview";
import { parseFeaturedAchievements } from "@/lib/profileCustomization";
import { parseProfileLayout, type ProfileBlock } from "@/lib/profileLayout";

const FRAME_COLORS: Record<string, string> = {
  task: "var(--mc-green-light)",
  goal: "var(--mc-gold)",
  challenge: "#a855f7",
};

const STAT_METRICS = [
  "play_time",
  "blocks_mined",
  "mob_kills",
  "player_kills",
  "deaths",
  "walk_one_cm",
  "jumps",
  "damage_dealt",
];

const MEDALS = ["#f2c94c", "#c9c9c9", "#c98b4b"];

function StatCard({ categoryKey, value }: { categoryKey: string; value: number }) {
  const category = getStatCategory(categoryKey);
  if (!category) return null;
  return (
    <div className="mc-inset px-3 py-2">
      <div className="text-[0.55rem] uppercase tracking-[0.14em] text-[var(--text-muted)]">
        {category.label}
      </div>
      <div className="font-mono text-xl leading-tight text-[var(--text)]">
        {formatStatValue(category, value)}
      </div>
    </div>
  );
}

function Block({
  title,
  action,
  children,
  full,
}: {
  title: string;
  action?: { href: string; label: string };
  children: React.ReactNode;
  full: boolean;
}) {
  return (
    <section className={`mc-panel overflow-hidden ${full ? "lg:col-span-2" : ""}`}>
      <div className="mc-head">
        <span className="min-w-0 flex-1 truncate">{title}</span>
        {action && (
          <Link
            href={action.href}
            className="text-[0.58rem] font-normal normal-case tracking-normal text-[var(--text-muted)] hover:text-[var(--mc-green-light)]"
          >
            {action.label} →
          </Link>
        )}
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="px-1 py-3 text-sm text-[var(--text-muted)]">{text}</p>;
}

/**
 * Вкладка «Обзор» — osu!-стиль: статистика, радар, топы, достижения и другие
 * блоки. Порядок, ширину и видимость игрок настраивает в /profile/settings/layout.
 */
export default async function ProfileOverviewPage({
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
  const baseHref = `/profile/${encodeURIComponent(target.nickname)}`;

  const [statRows, maxRows, tracks, photos, friends, audioTotal, photoTotal, friendTotal, activeSeason] =
    await Promise.all([
      db
        .select({
          category: playerStats.category,
          value: playerStats.value,
          updatedAt: playerStats.updatedAt,
        })
        .from(playerStats)
        .where(sql`lower(${playerStats.nickname}) = ${target.nickname.toLowerCase()}`)
        .all(),
      db
        .select({
          category: playerStats.category,
          max: sql<number>`max(${playerStats.value})`,
        })
        .from(playerStats)
        .groupBy(playerStats.category)
        .all(),
      loadAudioPreview(target.id, 5),
      loadPhotoPreview(target.id, 6),
      loadFriendPreview(target.id, 6),
      countAudio(target.id),
      countPhotos(target.id),
      countFriends(target.id),
      db
        .select()
        .from(seasons)
        .where(eq(seasons.isActive, true))
        .orderBy(desc(seasons.number))
        .get(),
    ]);

  const values: Record<string, number> = {};
  for (const row of statRows) values[row.category] = row.value;
  const maxByCategory: Record<string, number> = {};
  for (const row of maxRows) maxByCategory[row.category] = row.max;

  const ranked = await Promise.all(
    statRows
      .filter((row) => row.value > 0)
      .map(async (row) => {
        const higher = await db
          .select({ total: sql<number>`count(*)` })
          .from(playerStats)
          .where(and(eq(playerStats.category, row.category), gt(playerStats.value, row.value)))
          .get();
        return { ...row, rank: (higher?.total ?? 0) + 1 };
      })
  );
  const topRanks = ranked.sort((a, b) => a.rank - b.rank).slice(0, 8);

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
          .limit(6)
          .all();

  const layout = parseProfileLayout(target.profileLayout);
  const lastStatsUpdate =
    statRows.length > 0
      ? new Date(Math.max(...statRows.map((row) => row.updatedAt.getTime())))
      : null;

  function renderBlock(block: ProfileBlock) {
    switch (block.id) {
      case "stats":
        return (
          <Block
            key={block.id}
            title="Статистика"
            full={block.width === "full"}
            action={{ href: "/stats", label: "Вся статистика" }}
          >
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {STAT_METRICS.map((key) => (
                <StatCard key={key} categoryKey={key} value={values[key] ?? 0} />
              ))}
            </div>
            {lastStatsUpdate && (
              <p className="mt-2 text-right text-[0.55rem] text-[var(--text-muted)]">
                обновлено {lastStatsUpdate.toLocaleString("ru-RU")}
              </p>
            )}
          </Block>
        );

      case "radar":
        return (
          <Block
            key={block.id}
            title="Форма игрока"
            full={block.width === "full"}
            action={{ href: "/stats", label: "Сравнить" }}
          >
            {statRows.length === 0 ? (
              <Empty text="Статистика ещё не приходила с сервера." />
            ) : (
              <ProfileRadar values={values} maxByCategory={maxByCategory} />
            )}
          </Block>
        );

      case "top":
        return (
          <Block
            key={block.id}
            title="Топы сервера"
            full={block.width === "full"}
            action={{ href: "/stats", label: "Рейтинги" }}
          >
            {topRanks.length === 0 ? (
              <Empty text="Пока нет данных для рейтинга." />
            ) : (
              <ul className="flex flex-col divide-y-2 divide-black/30">
                {topRanks.map((row) => {
                  const category = getStatCategory(row.category);
                  if (!category) return null;
                  return (
                    <li key={row.category} className="flex items-center gap-2 py-1.5">
                      <span
                        className="w-7 shrink-0 text-center font-mono text-xs"
                        style={row.rank <= 3 ? { color: MEDALS[row.rank - 1] } : undefined}
                      >
                        #{row.rank}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs text-[var(--text-secondary)]">
                        {category.label}
                      </span>
                      <span className="font-mono text-xs text-[var(--text)]">
                        {formatStatValue(category, row.value)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Block>
        );

      case "achievements":
        return (
          <Block
            key={block.id}
            title="Достижения"
            full={block.width === "full"}
            action={{ href: `${baseHref}/appearance`, label: "Витрина" }}
          >
            {featured.length === 0 ? (
              <Empty text="Достижений пока нет." />
            ) : (
              <div className="grid grid-cols-1 gap-px bg-black/40 sm:grid-cols-2">
                {featured.map((achievement) => (
                  <div key={achievement.id} className="flex gap-2 bg-[var(--card)] p-2">
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
                      <div className="truncate text-xs font-semibold">{achievement.title}</div>
                      {achievement.description && (
                        <p className="line-clamp-2 text-[0.62rem] leading-snug text-[var(--text-muted)]">
                          {achievement.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Block>
        );

      case "season":
        return (
          <Block
            key={block.id}
            title="Сезон"
            full={block.width === "full"}
            action={{ href: "/seasons", label: "Все сезоны" }}
          >
            {activeSeason ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-2xl text-[var(--mc-green-light)]">
                    {activeSeason.number}
                  </span>
                  <span className="text-sm font-semibold">{activeSeason.name}</span>
                </div>
                {activeSeason.description && (
                  <p className="text-xs text-[var(--text-secondary)]">
                    {activeSeason.description}
                  </p>
                )}
                <Link
                  href={`/seasons/${activeSeason.number}`}
                  className="mc-btn mt-1 w-fit px-3 py-1.5 text-xs"
                >
                  Открыть сезон
                </Link>
              </div>
            ) : (
              <Empty text="Активный сезон ещё не выбран." />
            )}
          </Block>
        );

      case "friends":
        return (
          <Block
            key={block.id}
            title="Друзья"
            full={block.width === "full"}
            action={{ href: `${baseHref}/friends`, label: `Все (${friendTotal})` }}
          >
            {friends.length === 0 ? (
              <Empty text="Друзей пока нет." />
            ) : (
              <ul className="grid grid-cols-2 gap-2">
                {friends.map((friend) => (
                  <li key={friend.id}>
                    <Link
                      href={`/profile/${encodeURIComponent(friend.nickname)}`}
                      className="flex min-w-0 items-center gap-2 border-2 border-black bg-[var(--bg)] p-1.5 hover:bg-[var(--hover)]"
                    >
                      <PlayerHead
                        skinUrl={friend.skinUrl}
                        nickname={friend.nickname}
                        size={24}
                      />
                      <span className="truncate text-xs">{friend.nickname}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Block>
        );

      case "photos":
        return (
          <Block
            key={block.id}
            title="Фото"
            full={block.width === "full"}
            action={{ href: `${baseHref}/foto`, label: `Все (${photoTotal})` }}
          >
            {photos.length === 0 ? (
              <Empty text="Фото пока нет." />
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {photos.map((photo) => (
                  <Link
                    key={photo.id}
                    href={`${baseHref}/foto`}
                    className="relative aspect-square overflow-hidden border-2 border-black"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.thumbUrl}
                      alt={photo.caption ?? "Фото"}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </Link>
                ))}
              </div>
            )}
          </Block>
        );

      case "audio":
        return (
          <Block
            key={block.id}
            title="Аудио"
            full={block.width === "full"}
            action={{ href: `${baseHref}/music`, label: `Все (${audioTotal})` }}
          >
            {tracks.length === 0 ? (
              <Empty text="Треков пока нет." />
            ) : (
              <ul className="flex flex-col divide-y-2 divide-black/30">
                {tracks.map((track) => (
                  <li key={track.id} className="flex items-center gap-2 py-1.5">
                    <span className="mc-inset flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden text-sm">
                      {track.coverThumbUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={track.coverThumbUrl}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        "♪"
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs">{track.title}</div>
                      {track.artist && (
                        <div className="truncate text-[0.6rem] text-[var(--text-muted)]">
                          {track.artist}
                        </div>
                      )}
                    </div>
                    <audio controls preload="none" src={track.url} className="h-8 w-40" />
                  </li>
                ))}
              </ul>
            )}
          </Block>
        );

      default:
        return null;
    }
  }

  const visibleBlocks = layout.filter((block) => block.visible);

  return (
    <div className="flex flex-col gap-4">
      {isOwn && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-[var(--text-muted)]">
            Это твой обзор. Блоки можно менять местами и скрывать.
          </p>
          <Link
            href="/profile/settings/layout"
            className="mc-btn px-3 py-1.5 text-xs"
          >
            ⚙ Настроить блоки
          </Link>
        </div>
      )}

      {visibleBlocks.length === 0 ? (
        <div className="mc-inset p-8 text-center text-sm text-[var(--text-muted)]">
          Все блоки скрыты.{" "}
          {isOwn && (
            <Link href="/profile/settings/layout" className="text-[var(--mc-green-light)] underline">
              Включить обратно
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {visibleBlocks.map(renderBlock)}
        </div>
      )}

      <p className="text-right text-[0.58rem] text-[var(--text-muted)]">
        Всего категорий в статистике: {STAT_CATEGORIES.length}
      </p>
    </div>
  );
}
