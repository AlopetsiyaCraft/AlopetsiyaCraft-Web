import Link from "next/link";
import { redirect } from "next/navigation";
import { statSync } from "fs";
import { count, desc, eq, sql } from "drizzle-orm";
import { getAdminUser } from "@/lib/admin";
import { db } from "@/lib/db";
import {
  marketListings,
  pageViews,
  seasons,
  shopOrders,
  users,
} from "@/lib/db/schema";
import Header from "@/components/Header";

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days} д ${hours} ч`;
  if (hours > 0) return `${hours} ч ${minutes} мин`;
  return `${minutes} мин`;
}

/** /admin/system — состояние сервера и базы. */
export default async function AdminSystemPage() {
  const admin = await getAdminUser();
  if (!admin) {
    redirect(`/auth/login?callbackUrl=${encodeURIComponent("/admin/system")}`);
  }

  let dbOk = true;
  try {
    await db.run(sql`select 1`);
  } catch {
    dbOk = false;
  }

  const [allSeasons, me, userCount, pendingOrders, activeListings, viewsToday] =
    await Promise.all([
      db.select().from(seasons).orderBy(desc(seasons.number)).all(),
      db
        .select({ name: users.nickname, skinUrl: users.skinUrl, bld: users.bld })
        .from(users)
        .where(eq(users.id, admin.id))
        .get(),
      db.select({ total: count() }).from(users).get(),
      db
        .select({ total: count() })
        .from(shopOrders)
        .where(eq(shopOrders.status, "pending"))
        .get(),
      db
        .select({ total: count() })
        .from(marketListings)
        .where(eq(marketListings.status, "active"))
        .get(),
      db
        .select({ total: count() })
        .from(pageViews)
        .where(sql`${pageViews.createdAt} >= unixepoch() - 86400`)
        .get(),
    ]);

  const dbUrl = process.env.DATABASE_URL ?? "file:./data/database.db";
  let dbSize = "—";
  if (dbUrl.startsWith("file:")) {
    try {
      const bytes = statSync(dbUrl.slice("file:".length)).size;
      dbSize = `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
    } catch {
      dbSize = "файл не найден";
    }
  }

  const memory = process.memoryUsage();

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)]">
      <Header
        seasons={allSeasons}
        user={me ? { name: me.name, skinUrl: me.skinUrl, bld: me.bld } : undefined}
        isLoggedIn
      />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="mc-title text-3xl sm:text-4xl">Админка · система</h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              База, память и очередь. Healthcheck:{" "}
              <a href="/api/health" className="text-[var(--mc-green-light)] underline">
                /api/health
              </a>
            </p>
          </div>
          <Link href="/admin" className="mc-btn px-3 py-1.5 text-xs">
            ← В админку
          </Link>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            label="База"
            value={dbOk ? "ok" : "ошибка"}
            tone={dbOk ? "text-[var(--mc-green-light)]" : "text-[var(--mc-red)]"}
          />
          <Stat label="Отклик БД" value={dbOk ? "ok" : "—"} />
          <Stat label="Размер БД" value={dbSize} />
          <Stat label="Аптайм" value={formatUptime(process.uptime())} />
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Игроков" value={(userCount?.total ?? 0).toLocaleString("ru-RU")} />
          <Stat label="Ждут выдачи" value={(pendingOrders?.total ?? 0).toLocaleString("ru-RU")} />
          <Stat label="Лотов маркета" value={(activeListings?.total ?? 0).toLocaleString("ru-RU")} />
          <Stat label="Просмотров за сутки" value={(viewsToday?.total ?? 0).toLocaleString("ru-RU")} />
        </div>

        <section className="mc-panel overflow-hidden">
          <div className="mc-head">Процесс</div>
          <dl className="grid grid-cols-1 gap-px bg-black/40 sm:grid-cols-2">
            {[
              ["Node", process.version],
              ["Платформа", `${process.platform} / ${process.arch}`],
              ["RSS", `${Math.round(memory.rss / 1024 / 1024)} МБ`],
              ["Heap", `${Math.round(memory.heapUsed / 1024 / 1024)} МБ`],
              ["База", dbUrl.replace(/\/\/.*@/, "//***@")],
              ["Часовой пояс", process.env.TZ ?? "системный"],
            ].map(([label, value]) => (
              <div key={label} className="bg-[var(--card)] px-3 py-2">
                <dt className="text-[0.58rem] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  {label}
                </dt>
                <dd className="mt-0.5 break-all font-mono text-xs">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <p className="mt-4 text-xs text-[var(--text-muted)]">
          Для мониторинга подключи `/api/health` к UptimeRobot или cron-скрипту
          `npm run healthcheck`. Если база не отвечает, endpoint вернёт 503.
        </p>
      </main>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="mc-panel p-4">
      <div className="text-[0.58rem] uppercase tracking-[0.14em] text-[var(--text-muted)]">
        {label}
      </div>
      <div className={`mt-1 font-mono text-xl ${tone ?? "text-[var(--mc-gold)]"}`}>{value}</div>
    </div>
  );
}

export const metadata = {
  title: "Админка · система",
};
