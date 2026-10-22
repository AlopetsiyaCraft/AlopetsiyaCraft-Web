import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { playerStats, seasons, users } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import Header from "@/components/Header";
import PlayerHead from "@/components/mc/PlayerHead";
import {
  STAT_CATEGORIES,
  STAT_CATEGORY_KEYS,
  PLAY_TIME_KEY,
  formatStatValue,
  getStatCategory,
} from "@/lib/stats";

/**
 * Статистика сервера: лидерборды по категориям (как лидерборды osu!).
 * Данные присылает мост (мод chatbridge / скрипт на хосте) в
 * POST /api/stats/from-server — значения ванильной статистики Minecraft.
 */

const MEDALS = ["#f2c94c", "#c9c9c9", "#c98b4b"];

/** Крупная цифра метрики для активной категории. */
function metricValue(key: string, values: Map<string, number>) {
  const category = STAT_CATEGORIES.find((c) => c.key === key);
  if (!category) return "—";
  return formatStatValue(category, values.get(key) ?? 0);
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
        .select({ name: users.nickname, skinUrl: users.skinUrl, bld: users.bld })
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
  const activeCategory = getStatCategory(sortKey);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)]">
      <Header
        seasons={allSeasons}
        user={viewer ? { name: viewer.name, skinUrl: viewer.skinUrl, bld: viewer.bld } : undefined}
        isLoggedIn={!!session}
      />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="mc-title text-3xl sm:text-4xl">Статистика</h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {activeCategory?.hint ?? "Топ игроков сервера"}
            </p>
          </div>
          <span className="mc-chip text-[0.65rem] text-[var(--text-secondary)]">
            Игроков: {rows.length}
          </span>
        </div>

        {/* Категории-табы */}
        <div className="mc-panel-flat no-scrollbar flex gap-1 overflow-x-auto p-1.5">
          {STAT_CATEGORIES.map((c) => {
            const active = c.key === sortKey;
            return (
              <Link
                key={c.key}
                href={`/stats?sort=${c.key}`}
                className={`shrink-0 border-2 px-3 py-1.5 text-[0.72rem] font-bold uppercase tracking-[0.08em] transition-colors ${
                  active
                    ? "border-black bg-[var(--mc-green)] text-[#0f1a08]"
                    : "border-transparent text-[var(--text-muted)] hover:border-black hover:bg-[var(--hover)] hover:text-[var(--text)]"
                }`}
              >
                {c.label}
              </Link>
            );
          })}
        </div>

        {rows.length === 0 ? (
          <div className="mc-inset p-8 text-center text-sm text-[var(--text-muted)]">
            Пока нет данных — статистика появится, когда сервер начнёт присылать её на сайт.
          </div>
        ) : (
          <>
            {/* Пьедестал: топ-3 по активной категории */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {rows.slice(0, 3).map((row, i) => (
                <div
                  key={row.nickname}
                  className="mc-panel flex items-center gap-3 p-3"
                  style={{ borderTop: `6px solid ${MEDALS[i]}` }}
                >
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center border-2 border-black font-mono text-sm font-bold text-[#1a1a1a]"
                    style={{ backgroundColor: MEDALS[i] }}
                  >
                    {i + 1}
                  </span>
                  <PlayerHead skinUrl={row.skinUrl} nickname={row.nickname} size={36} />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/profile/${encodeURIComponent(row.nickname)}`}
                      className="block truncate text-sm font-semibold hover:text-[var(--mc-green-light)]"
                    >
                      {row.nickname}
                    </Link>
                    <div className="truncate font-mono text-lg leading-tight text-[var(--mc-gold)]">
                      {metricValue(sortKey, row.values)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Полный список */}
            <div className="mc-panel overflow-hidden">
              <div className="mc-head">
                <span className="min-w-0 flex-1 truncate">Рейтинг · {activeCategory?.label}</span>
                <span className="mc-chip text-[0.6rem] text-[var(--text-muted)]">сортировка</span>
              </div>
              <ol>
                {rows.map((row, index) => {
                  const rank = index + 1;
                  const isViewer =
                    viewerNickname !== null && row.nickname.toLowerCase() === viewerNickname;
                  const top = rank <= 3;
                  return (
                    <li key={row.nickname} className="border-b-2 border-black/40 last:border-b-0">
                      <div
                        className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${
                          isViewer
                            ? "bg-[rgba(125,187,82,0.14)]"
                            : top
                              ? "bg-[var(--card-alt)]"
                              : "hover:bg-[var(--hover)]"
                        }`}
                      >
                        <span
                          className={`w-7 shrink-0 text-center font-mono text-sm ${
                            top ? "font-bold" : "text-[var(--text-muted)]"
                          }`}
                          style={top ? { color: MEDALS[rank - 1] } : undefined}
                        >
                          {rank}
                        </span>

                        <PlayerHead skinUrl={row.skinUrl} nickname={row.nickname} size={34} />

                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/profile/${encodeURIComponent(row.nickname)}`}
                            className="flex items-center gap-2"
                          >
                            <span className="truncate text-sm font-semibold">{row.nickname}</span>
                            {isViewer && (
                              <span className="mc-chip shrink-0 text-[0.55rem] text-[var(--mc-green-light)]">
                                ты
                              </span>
                            )}
                          </Link>
                          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[11px] text-[var(--text-muted)]">
                            <span>⏱ {metricValue(PLAY_TIME_KEY, row.values)}</span>
                            <span className="hidden sm:inline">
                              🗡 {metricValue("mob_kills", row.values)}
                            </span>
                            <span className="hidden md:inline">
                              ⛏ {metricValue("blocks_mined", row.values)}
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0 text-right font-mono text-base text-[var(--text)] sm:text-lg">
                          {metricValue(sortKey, row.values)}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export const metadata = {
  title: "Статистика",
  description: "Топ игроков сервера по всем категориям статистики, сортировка по клику",
};