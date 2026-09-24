import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { playerStats, seasons, users } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import Header from "@/components/Header";
import {
  STAT_CATEGORIES,
  STAT_CATEGORY_KEYS,
  PLAY_TIME_KEY,
  getStatCategory,
  formatStatValue,
  formatPlayTimeTicks,
} from "@/lib/stats";

/**
 * Статистика сервера: лидерборды по категориям (как лидерборды osu!).
 * Данные присылает мост (мод chatbridge / скрипт на хосте) в
 * POST /api/stats/from-server — значения ванильной статистики Minecraft.
 */

function PlayerHead({ skinUrl, nickname }: { skinUrl: string | null; nickname: string }) {
  if (!skinUrl) {
    return (
      <div className="w-9 h-9 bg-[#7c3aed] rounded flex items-center justify-center text-sm font-bold flex-shrink-0">
        {nickname[0]?.toUpperCase() || "?"}
      </div>
    );
  }
  return (
    <div className="w-9 h-9 rounded relative overflow-hidden flex-shrink-0">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${skinUrl})`,
          backgroundSize: "288px 288px",
          backgroundPosition: "-36px -36px",
          imageRendering: "pixelated",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${skinUrl})`,
          backgroundSize: "288px 288px",
          backgroundPosition: "-180px -36px",
          imageRendering: "pixelated",
        }}
      />
    </div>
  );
}

interface Row {
  nickname: string;
  skinUrl: string | null;
  playtime: number;
  value: number;
}

async function getLeaderboard(
  categoryKey: string
): Promise<{ rows: Row[]; total: number }> {
  // База лидерборда — все зарегистрированные пользователи сайта: они видны
  // всегда, даже если ещё не заходили на сервер (у них 0 по всем категориям,
  // поэтому сортируются вниз). К ним подмешиваются ники, присланные сервером
  // (на случай, если в статах есть игрок без аккаунта на сайте).
  const registeredUsers = await db
    .select({ nickname: users.nickname, skinUrl: users.skinUrl })
    .from(users)
    .all();

  const playtimeRows = await db
    .select({
      nickname: playerStats.nickname,
      value: playerStats.value,
    })
    .from(playerStats)
    .where(eq(playerStats.category, PLAY_TIME_KEY))
    .all();

  const categoryRows = await db
    .select({
      nickname: playerStats.nickname,
      value: playerStats.value,
    })
    .from(playerStats)
    .where(eq(playerStats.category, categoryKey))
    .all();

  // Ключи — в нижнем регистре: никнеймы Minecraft уникальны без учёта регистра,
  // а на сайте регистрация может отличаться по регистру (AlexMilash vs alexmilash).
  const playtimeByNick = new Map(playtimeRows.map((r) => [r.nickname.toLowerCase(), r.value]));
  const valueByNick = new Map(categoryRows.map((r) => [r.nickname.toLowerCase(), r.value]));

  // Отображаем ник как в профиле (для зарегистрированных), иначе — как прислал сервер.
  const displayNick = new Map<string, string>();
  for (const u of registeredUsers) displayNick.set(u.nickname.toLowerCase(), u.nickname);
  for (const n of [...playtimeByNick.keys(), ...valueByNick.keys()]) {
    if (!displayNick.has(n)) displayNick.set(n, n);
  }

  const skinByNick = new Map<string, string | null>();
  for (const u of registeredUsers) skinByNick.set(u.nickname.toLowerCase(), u.skinUrl);

  const rows = [...displayNick.keys()]
    .map((key) => ({
      nickname: displayNick.get(key)!,
      skinUrl: skinByNick.get(key) ?? null,
      playtime: playtimeByNick.get(key) ?? 0,
      value: valueByNick.get(key) ?? 0,
    }))
    .sort(
      (a, b) =>
        b.value - a.value ||
        b.playtime - a.playtime ||
        a.nickname.localeCompare(b.nickname, "ru")
    );

  return { rows, total: rows.length };
}

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const sp = await searchParams;
  const session = await auth();
  const allSeasons = await db.select().from(seasons).orderBy(desc(seasons.number)).all();

  const viewer = session?.user?.id
    ? await db
        .select({ name: users.nickname, skinUrl: users.skinUrl })
        .from(users)
        .where(eq(users.id, parseInt(session.user.id, 10)))
        .get()
    : null;

  const categoryKey =
    typeof sp?.category === "string" && STAT_CATEGORY_KEYS.has(sp.category)
      ? sp.category
      : "deaths";
  const category = getStatCategory(categoryKey)!;

  const { rows } = await getLeaderboard(categoryKey);
  const viewerNickname = viewer?.name?.toLowerCase() ?? null;

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Header
        seasons={allSeasons}
        user={viewer ? { name: viewer.name, skinUrl: viewer.skinUrl } : undefined}
        isLoggedIn={!!session}
      />

      <main className="max-w-5xl mx-auto px-4 py-8 flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold">Статистика</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            Топ игроков сервера по выбранной категории.
          </p>
        </div>

        {/* Переключатель категорий */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
          {STAT_CATEGORIES.map((c) => {
            const active = c.key === categoryKey;
            return (
              <Link
                key={c.key}
                href={`/stats?category=${c.key}`}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm transition-colors cursor-pointer ${
                  active
                    ? "bg-[#7c3aed] text-white"
                    : "bg-[var(--card)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text)]"
                }`}
              >
                {c.label}
              </Link>
            );
          })}
        </div>

        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <h2 className="font-semibold">{category.label}</h2>
            <p className="text-[var(--text-muted)] text-xs mt-0.5">{category.hint}</p>
          </div>

          {rows.length === 0 ? (
            <div className="p-8 text-center text-[var(--text-muted)] text-sm">
              Пока нет данных — статистика появится, когда сервер начнёт присылать её на сайт
              (мод chatbridge или скрипт, читающий <span className="font-mono">world/stats/*.json</span>).
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[var(--text-muted)] border-b border-[var(--border)] bg-[var(--bg-alt)]">
                    <th className="px-4 py-3 w-16 text-right font-medium">#</th>
                    <th className="px-4 py-3 font-medium">Игрок</th>
                    {category.format !== "playtime" && (
                      <th className="px-4 py-3 text-right font-medium whitespace-nowrap">
                        Время в игре
                      </th>
                    )}
                    <th className="px-4 py-3 text-right font-medium whitespace-nowrap">
                      {category.label}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    const rank = index + 1;
                    const isViewer = viewerNickname !== null && row.nickname.toLowerCase() === viewerNickname;
                    return (
                      <tr
                        key={row.nickname}
                        className={`border-b border-[var(--border)] last:border-0 ${
                          isViewer ? "bg-[#7c3aed]/10" : "hover:bg-[var(--hover)]"
                        }`}
                      >
                        <td className="px-4 py-3 font-mono font-semibold text-[var(--text-muted)] text-right">
                          #{rank}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/profile/${encodeURIComponent(row.nickname)}`}
                            className="flex items-center gap-3 cursor-pointer"
                          >
                            <PlayerHead skinUrl={row.skinUrl} nickname={row.nickname} />
                            <span className="font-medium">{row.nickname}</span>
                            {isViewer && (
                              <span className="text-xs px-1.5 py-0.5 bg-[#7c3aed] text-white rounded-full">
                                вы
                              </span>
                            )}
                          </Link>
                        </td>
                        {category.format !== "playtime" && (
                          <td className="px-4 py-3 text-right font-mono text-[var(--text-muted)] whitespace-nowrap">
                            {formatPlayTimeTicks(row.playtime)}
                          </td>
                        )}
                        <td className="px-4 py-3 text-right font-mono font-semibold whitespace-nowrap">
                          {formatStatValue(category, row.value)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export const metadata = {
  title: "Статистика — АлопецияКрафт",
  description: "Топ игроков сервера по категориям статистики",
};