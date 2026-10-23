import { redirect } from "next/navigation";
import Link from "next/link";
import { and, count, desc, eq, gte, notLike, sql } from "drizzle-orm";
import { getAdminUser } from "@/lib/admin";
import { db } from "@/lib/db";
import { pageViews, seasons, users } from "@/lib/db/schema";
import Header from "@/components/Header";

/** Разделы, за которыми следим: если 0 просмотров — раздел мёртвый. */
const SECTIONS: Array<{ path: string; label: string }> = [
  { path: "/", label: "Главная" },
  { path: "/stats", label: "Статистика" },
  { path: "/shop", label: "Магазин" },
  { path: "/gallery", label: "Галерея" },
  { path: "/music", label: "Музыка" },
  { path: "/seasons", label: "Сезоны" },
  { path: "/profile/*", label: "Профили" },
  { path: "/inventory", label: "Инвентарь" },
  { path: "/wallet", label: "Кошелёк" },
  { path: "/auth/login", label: "Вход" },
];

function formatWhen(seconds: number | null) {
  if (!seconds) return "—";
  const date = new Date(seconds * 1000);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const admin = await getAdminUser();
  if (!admin) {
    redirect(`/auth/login?callbackUrl=${encodeURIComponent("/admin/analytics")}`);
  }

  const sp = await searchParams;
  const days = sp.days === "7" ? 7 : 30;
  // Считаем границу прямо в SQLite, чтобы не зависеть от часов Node.
  const cutoff = sql`unixepoch() - ${days * 24 * 60 * 60}`;

  const [allSeasons, me, rows, totals, devices, sources] = await Promise.all([
    db.select().from(seasons).orderBy(desc(seasons.number)).all(),
    db
      .select({ name: users.nickname, skinUrl: users.skinUrl, bld: users.bld })
      .from(users)
      .where(eq(users.id, admin.id))
      .get(),
    db
      .select({
        path: pageViews.path,
        views: count(),
        sessions: sql<number>`count(distinct ${pageViews.sessionId})`,
        last: sql<number | null>`max(${pageViews.createdAt})`,
      })
      .from(pageViews)
      .where(and(gte(pageViews.createdAt, cutoff), notLike(pageViews.path, "/admin%")))
      .groupBy(pageViews.path)
      .orderBy(desc(count()), desc(pageViews.path))
      .all(),
    db
      .select({
        views: count(),
        sessions: sql<number>`count(distinct ${pageViews.sessionId})`,
      })
      .from(pageViews)
      .where(and(gte(pageViews.createdAt, cutoff), notLike(pageViews.path, "/admin%")))
      .get(),
    db
      .select({ device: pageViews.device, views: count() })
      .from(pageViews)
      .where(and(gte(pageViews.createdAt, cutoff), notLike(pageViews.path, "/admin%")))
      .groupBy(pageViews.device)
      .all(),
    db
      .select({ source: pageViews.source, views: count() })
      .from(pageViews)
      .where(and(gte(pageViews.createdAt, cutoff), notLike(pageViews.path, "/admin%")))
      .groupBy(pageViews.source)
      .all(),
  ]);

  const totalViews = totals?.views ?? 0;
  const totalSessions = totals?.sessions ?? 0;
  const mobileViews =
    devices.find((item) => item.device === "mobile")?.views ?? 0;
  const tabletViews =
    devices.find((item) => item.device === "tablet")?.views ?? 0;
  const telegramViews =
    sources.find((item) => item.source === "telegram")?.views ?? 0;
  const maxViews = Math.max(1, ...rows.map((row) => row.views));

  const viewed = new Set(rows.map((row) => row.path));
  const deadSections = SECTIONS.filter((section) => !viewed.has(section.path));

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)]">
      <Header
        seasons={allSeasons}
        user={me ? { name: me.name, skinUrl: me.skinUrl, bld: me.bld } : undefined}
        isLoggedIn
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="mc-title text-3xl sm:text-4xl">Админка · аналитика</h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Какие разделы сайта смотрят, а какие мёртвые. Без cookie и внешних сервисов.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {[7, 30].map((value) => (
              <Link
                key={value}
                href={`/admin/analytics?days=${value}`}
                className={`border-2 px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.08em] ${
                  days === value
                    ? "border-black bg-[var(--mc-green)] text-[#0f1a08]"
                    : "border-black bg-[var(--bg)] text-[var(--text-muted)] hover:bg-[var(--hover)]"
                }`}
              >
                {value} дней
              </Link>
            ))}
            <Link href="/admin" className="mc-btn px-3 py-1.5 text-xs">
              ← В админку
            </Link>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Просмотров" value={totalViews.toLocaleString("ru-RU")} />
          <Stat label="Уникальных сессий" value={totalSessions.toLocaleString("ru-RU")} />
          <Stat
            label="С телефона"
            value={
              totalViews > 0
                ? `${Math.round(((mobileViews + tabletViews) / totalViews) * 100)}%`
                : "—"
            }
          />
          <Stat
            label="Из Telegram"
            value={totalViews > 0 ? `${Math.round((telegramViews / totalViews) * 100)}%` : "—"}
          />
        </div>

        {deadSections.length > 0 && (
          <section className="mc-panel mb-4 overflow-hidden">
            <div className="mc-head">
              <span className="min-w-0 flex-1 truncate">Мёртвые разделы</span>
              <span className="mc-chip text-[0.58rem] text-[var(--mc-red)]">
                {deadSections.length}
              </span>
            </div>
            <div className="flex flex-wrap gap-2 p-3">
              {deadSections.map((section) => (
                <span
                  key={section.path}
                  className="border-2 border-black bg-[var(--bg)] px-2 py-1 text-xs text-[var(--text-secondary)]"
                >
                  {section.label}{" "}
                  <span className="font-mono text-[0.58rem] text-[var(--text-muted)]">
                    {section.path}
                  </span>
                </span>
              ))}
            </div>
            <p className="border-t-2 border-black/40 px-3 py-2 text-xs text-[var(--text-muted)]">
              За последние {days} дней сюда не было ни одного захода.
            </p>
          </section>
        )}

        <section className="mc-panel overflow-hidden">
          <div className="mc-head">
            <span className="min-w-0 flex-1 truncate">Разделы</span>
            <span className="mc-chip text-[0.58rem] text-[var(--text-muted)]">
              за {days} дней · без /admin
            </span>
          </div>
          {rows.length === 0 ? (
            <div className="p-8 text-center text-sm text-[var(--text-muted)]">
              Пока нет данных. Зайди на пару страниц — события появятся здесь.
            </div>
          ) : (
            <div className="flex flex-col gap-2 p-3">
              {rows.map((row, index) => (
                <div key={row.path} className="flex flex-wrap items-center gap-2">
                  <span className="w-5 shrink-0 text-center font-mono text-[0.62rem] text-[var(--text-muted)]">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-[var(--text)]">
                    {row.path}
                  </span>
                  <div className="relative h-4 w-full max-w-[18rem] border-2 border-black bg-[var(--bg)] sm:w-48">
                    <div
                      className="h-full"
                      style={{
                        width: `${Math.max(1.5, (row.views / maxViews) * 100)}%`,
                        backgroundColor: "var(--mc-green-dark)",
                        boxShadow: "inset -2px -2px 0 rgba(0,0,0,0.35)",
                      }}
                    />
                  </div>
                  <span className="w-16 shrink-0 text-right font-mono text-[0.68rem] text-[var(--text-secondary)]">
                    {row.views.toLocaleString("ru-RU")}
                  </span>
                  <span
                    className="w-16 shrink-0 text-right font-mono text-[0.62rem] text-[var(--text-muted)]"
                    title="Уникальные сессии"
                  >
                    {row.sessions}
                  </span>
                  <span className="hidden w-24 shrink-0 text-right font-mono text-[0.6rem] text-[var(--text-muted)] sm:block">
                    {formatWhen(row.last)}
                  </span>
                </div>
              ))}
            </div>
          )}
          {rows.length > 0 && (
            <div className="border-t-2 border-black/40 px-3 py-2 text-[0.6rem] uppercase tracking-[0.08em] text-[var(--text-muted)]">
              путь · просмотры · сессии · последний заход
            </div>
          )}
        </section>

        <p className="mt-4 text-xs text-[var(--text-muted)]">
          Повторный заход на ту же страницу в течение 30 минут не считается. IP и точные
          данные браузера не сохраняются — только путь, тип устройства и источник.
        </p>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="mc-panel p-4">
      <div className="text-[0.58rem] uppercase tracking-[0.14em] text-[var(--text-muted)]">
        {label}
      </div>
      <div className="mt-1 font-mono text-2xl text-[var(--mc-gold)]">{value}</div>
    </div>
  );
}

export const metadata = {
  title: "Админка · аналитика",
};
