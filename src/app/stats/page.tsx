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
  formatStatValue,
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
  /** Значения по всем категориям: ключ категории → число (0, если данных нет). */
  values: Map<string, number>;
}

async function getLeaderboard(
  sortKey: string
): Promise<{ rows: Row[]; total: number }> {
  // База лидерборда — все зарегистрированные пользователи сайта: они видны
  // всегда, даже если ещё не заходили на сервер (у них 0 по всем категориям,
  // поэтому сортируются вниз). К ним подмешиваются ники, присланные сервером
  // (на случай, если в статах есть игрок без аккаунта на сайте).
  const registeredUsers = await db
    .select({ nickname: users.nickname, skinUrl: users.skinUrl })
    .from(users)
    .all();

  const statRows = await db
    .select({
      nickname: playerStats.nickname,
      category: playerStats.category,
      value: playerStats.value,
    })
    .from(playerStats)
    .all();

  // Ключи — в нижнем регистре: никнеймы Minecraft уникальны без учёта регистра,
  // а на сайте регистрация может отличаться по регистру (AlexMilash vs alexmilash).
  const valuesByNick = new Map<string, Map<string, number>>();
  const nicks = new Set<string>();
  for (const u of registeredUsers) nicks.add(u.nickname.toLowerCase());
  for (const s of statRows) {
    const key = s.nickname.toLowerCase();
    nicks.add(key);
    if (!valuesByNick.has(key)) valuesByNick.set(key, new Map());
    valuesByNick.get(key)!.set(s.category, s.value);
  }

  // Отображаем ник как в профиле (для зарегистрированных), иначе — как прислал сервер.
  const displayNick = new Map<string, string>();
  for (const u of registeredUsers) displayNick.set(u.nickname.toLowerCase(), u.nickname);
  for (const n of nicks) if (!displayNick.has(n)) displayNick.set(n, n);

  const skinByNick = new Map<string, string | null>();
  for (const u of registeredUsers) skinByNick.set(u.nickname.toLowerCase(), u.skinUrl);

  const playtime = (values: Map<string, number>) => values.get(PLAY_TIME_KEY) ?? 0;

  const rows = [...nicks]
    .map((key) => ({
      nickname: displayNick.get(key)!,
      skinUrl: skinByNick.get(key) ?? null,
      values: valuesByNick.get(key) ?? new Map(),
    }))
    .sort(
      (a, b) =>
        (b.values.get(sortKey) ?? 0) - (a.values.get(sortKey) ?? 0) ||
        playtime(b.values) - playtime(a.values) ||
        a.nickname.localeCompare(b.nickname, "ru")
    );

  return { rows, total: rows.length };
}

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
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

  // Сортировка по умолчанию — «Время в игре»; клик по заголовку столбца
  // переключает её через ?sort=ключ_категории.
  const sortKey =
    typeof sp?.sort === "string" && STAT_CATEGORY_KEYS.has(sp.sort)
      ? sp.sort
      : PLAY_TIME_KEY;

  const { rows } = await getLeaderboard(sortKey);
  const viewerNickname = viewer?.name?.toLowerCase() ?? null;

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Header
        seasons={allSeasons}
        user={viewer ? { name: viewer.name, skinUrl: viewer.skinUrl } : undefined}
        isLoggedIn={!!session}
      />

      <main className="max-w-7xl mx-auto px-4 py-8 flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold">Статистика</h1>
        </div>

        {rows.length === 0 ? (
          <div className="p-8 text-center text-[var(--text-muted)] text-sm border border-[var(--border)] rounded-lg">
            Пока нет данных — статистика появится, когда сервер начнёт присылать её на сайт
            (мод chatbridge или скрипт, читающий <span className="font-mono">world/stats/*.json</span>).
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Заголовки колонок висят над карточкой — у них нет фона;
                фон только у таблицы со списком игроков ниже. */}
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col className="w-12" />
                <col />
                {STAT_CATEGORIES.map((c) => (
                  <col key={c.key} className="w-24" />
                ))}
              </colgroup>
              <thead>
                <tr className="text-[var(--text-muted)]">
                  <th className="px-4 py-2" aria-hidden="true"></th>
                  <th className="px-4 py-2" aria-hidden="true"></th>
                  {STAT_CATEGORIES.map((c) => {
                    const active = c.key === sortKey;
                    return (
                      <th key={c.key} className="text-center font-semibold">
                        <Link
                          href={`/stats?sort=${c.key}`}
                          className={`flex items-center justify-center w-full h-full px-2 py-2 cursor-pointer transition-colors ${
                            active
                              ? "text-[var(--text)]"
                              : "text-[var(--text-muted)] hover:text-[var(--text)]"
                          }`}
                        >
                          {c.label}
                        </Link>
                      </th>
                    );
                  })}
                </tr>
              </thead>
            </table>

            <div className="mt-1 bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
              <table className="w-full text-sm table-fixed border-separate border-spacing-y-[3px]">
                <colgroup>
                  <col className="w-12" />
                  <col />
                  {STAT_CATEGORIES.map((c) => (
                    <col key={c.key} className="w-24" />
                  ))}
                </colgroup>
                <tbody>
                  {rows.map((row, index) => {
                    const rank = index + 1;
                    const isViewer = viewerNickname !== null && row.nickname.toLowerCase() === viewerNickname;
                    return (
                      <tr
                        key={row.nickname}
                        className={
                          isViewer
                            ? "bg-[#7c3aed]/10"
                            : "bg-[var(--bubble)] hover:bg-[var(--hover)]"
                        }
                      >
                        <td className="px-2 py-3 font-mono font-semibold text-[var(--text-muted)] text-center">
                          #{rank}
                        </td>
                        <td className="pl-3 pr-4 py-3">
                          <Link
                            href={`/profile/${encodeURIComponent(row.nickname)}`}
                            className="flex items-center gap-3 cursor-pointer"
                          >
                            <PlayerHead skinUrl={row.skinUrl} nickname={row.nickname} />
                            <span className="font-medium">{row.nickname}</span>
                          </Link>
                        </td>
                        {STAT_CATEGORIES.map((c) => (
                          <td
                            key={c.key}
                            className={`px-2 py-3 text-center font-mono whitespace-nowrap ${
                              c.key === sortKey
                                ? "text-[var(--text)]"
                                : "text-[var(--text-muted)]"
                            }`}
                          >
                            {formatStatValue(c, row.values.get(c.key) ?? 0)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export const metadata = {
  title: "Статистика — АлопецияКрафт",
  description: "Топ игроков сервера по всем категориям статистики, сортировка по клику",
};