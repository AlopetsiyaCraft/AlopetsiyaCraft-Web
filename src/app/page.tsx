import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { achievements, playersOnline, seasons, users } from "@/lib/db/schema";
import { desc, eq, count } from "drizzle-orm";
import Link from "next/link";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import ServerIp from "@/components/mc/ServerIp";
import DockedChat from "@/components/DockedChat";
import PlayersOnline from "@/components/PlayersOnline";
import AchievementsFeed from "@/components/AchievementsFeed";
import BlueMapSection from "@/components/BlueMapSection";

const FEATURES = [
  {
    href: "/stats",
    title: "Статистика",
    text: "Лидерборды по добыче, боям и времени в игре.",
    icon: "M3 20V10m6 10V4m6 16v-7m6 7V8",
  },
  {
    href: "/gallery",
    title: "Галерея",
    text: "Скриншоты и лучшие моменты сезонов.",
    icon: "M4 5h16v14H4zM8 11l3 3 2-2 3 4H6z",
  },
  {
    href: "/inventory",
    title: "Инвентарь",
    text: "Весь лут, броня и эндер-сундук онлайн.",
    icon: "M4 6h16v12H4zM9 6v12M15 6v12M4 12h16",
  },
  {
    href: "/shop",
    title: "Магазин",
    text: "Трать болды на полезные мелочи для игры.",
    icon: "M4 7h16l-1.5 10H5.5zM9 7V5a3 3 0 016 0v2",
  },
];

export default async function Home() {
  const session = await auth();
  const [allSeasons, userRows, achievementRows, onlineRows] = await Promise.all([
    db.select().from(seasons).orderBy(desc(seasons.number)).all(),
    db.select({ total: count() }).from(users).get(),
    db.select({ total: count() }).from(achievements).get(),
    db.select({ total: count() }).from(playersOnline).get(),
  ]);

  let user = null;
  if (session?.user?.id) {
    user = await db
      .select({ name: users.nickname, skinUrl: users.skinUrl, bld: users.bld })
      .from(users)
      .where(eq(users.id, parseInt(session.user.id)))
      .get();
  }

  const activeSeason = allSeasons.find((s) => s.isActive) ?? allSeasons[0] ?? null;

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)]">
      <Header
        seasons={allSeasons}
        user={user ? { name: user.name, skinUrl: user.skinUrl, bld: user.bld } : undefined}
        isLoggedIn={!!session}
      />

      <main className="flex-1">
        <Hero
          activeSeason={activeSeason?.number ?? null}
          totalPlayers={userRows?.total ?? 0}
          totalAchievements={achievementRows?.total ?? 0}
          online={onlineRows?.total ?? 0}
        />

        {/* Быстрые ссылки */}
        <section className="mx-auto max-w-7xl px-4 py-10">
          <div className="mb-4 flex items-end justify-between gap-4">
            <h2 className="text-lg font-bold uppercase tracking-[0.12em] sm:text-xl">
              <span className="text-[var(--mc-green-light)]">#</span> Разделы
            </h2>
            <span className="hidden font-mono text-xs text-[var(--text-muted)] sm:block">
              выбери, куда идти
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <Link
                key={f.href}
                href={f.href}
                className="mc-panel group flex flex-col gap-3 p-4 transition-transform hover:-translate-y-0.5"
              >
                <span className="mc-panel-flat flex h-10 w-10 items-center justify-center bg-[var(--mc-green-dark)]">
                  <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                    <path strokeLinecap="square" strokeLinejoin="miter" d={f.icon} />
                  </svg>
                </span>
                <span className="text-sm font-bold uppercase tracking-[0.1em] group-hover:text-[var(--mc-green-light)]">
                  {f.title}
                </span>
                <span className="text-sm leading-snug text-[var(--text-secondary)]">{f.text}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Как зайти */}
        <section className="mx-auto max-w-7xl px-4 pb-12">
          <div className="mc-panel overflow-hidden">
            <div className="mc-head">
              <span className="flex shrink-0 items-center text-[var(--mc-green-light)]">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                  <path strokeLinecap="square" d="M5 3v4M3 5h4M18 17v4m-2-2h4M13 3l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143z" />
                </svg>
              </span>
              <span className="min-w-0 flex-1 truncate">Как зайти на сервер</span>
            </div>
            <div className="grid grid-cols-1 gap-px bg-black/50 sm:grid-cols-3">
              {[
                {
                  n: 1,
                  title: "Открой Minecraft",
                  text: "Java Edition 1.21.1, любой лаунчер.",
                },
                {
                  n: 2,
                  title: "Добавь сервер",
                  text: "«Сетевая игра» → «Добавить сервер» и вставь IP.",
                },
                {
                  n: 3,
                  title: "Заходи в игру",
                  text: "Ник — как на сайте, чтобы видеть статистику и профиль.",
                },
              ].map((step) => (
                <div key={step.n} className="flex items-start gap-3 bg-[var(--card)] p-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center border-2 border-black bg-[var(--mc-green)] font-mono text-base font-bold text-[#0f1a08]">
                    {step.n}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-bold uppercase tracking-[0.08em]">{step.title}</div>
                    <p className="mt-1 text-sm leading-snug text-[var(--text-secondary)]">{step.text}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-3 border-t-2 border-black bg-[var(--card-alt)] p-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs uppercase tracking-wider text-[var(--text-muted)]">
                Адрес сервера
              </span>
              <ServerIp compact />
            </div>
          </div>
        </section>

        {/* Карта + чат + игроки + достижения */}
        <section id="map" className="mx-auto max-w-7xl px-4 pb-14">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <BlueMapSection />
              <DockedChat isLoggedIn={!!session} />
            </div>
            <div className="flex flex-col gap-6">
              <PlayersOnline />
              <AchievementsFeed />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t-2 border-black bg-[var(--bg-alt)]">
        <div className="mc-grass-line" />
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-[var(--text-muted)] sm:flex-row">
          <span>© {new Date().getFullYear()} АлопецияКрафт</span>
          <span className="text-center text-xs">
            Не является официальным продуктом Minecraft. Не одобрено Mojang AB.
          </span>
        </div>
      </footer>
    </div>
  );
}
