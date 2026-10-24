import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { getAdminUser } from "@/lib/admin";
import { auditActionLabel } from "@/lib/adminAudit";
import { db } from "@/lib/db";
import { adminAudit, seasons, users } from "@/lib/db/schema";
import Header from "@/components/Header";

/** /admin/audit — журнал действий администратора. */
export default async function AdminAuditPage() {
  const admin = await getAdminUser();
  if (!admin) {
    redirect(`/auth/login?callbackUrl=${encodeURIComponent("/admin/audit")}`);
  }

  const [allSeasons, me, rows] = await Promise.all([
    db.select().from(seasons).orderBy(desc(seasons.number)).all(),
    db
      .select({ name: users.nickname, skinUrl: users.skinUrl, bld: users.bld })
      .from(users)
      .where(eq(users.id, admin.id))
      .get(),
    db.select().from(adminAudit).orderBy(desc(adminAudit.createdAt)).limit(150).all(),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)]">
      <Header
        seasons={allSeasons}
        user={me ? { name: me.name, skinUrl: me.skinUrl, bld: me.bld } : undefined}
        isLoggedIn
      />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="mc-title text-3xl sm:text-4xl">Админка · аудит</h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Кто, что и когда менял: роли, сезоны, магазин, экономика и рассылки.
            </p>
          </div>
          <Link href="/admin" className="mc-btn px-3 py-1.5 text-xs">
            ← В админку
          </Link>
        </div>

        <section className="mc-panel overflow-hidden">
          <div className="mc-head">
            <span className="min-w-0 flex-1 truncate">Последние действия</span>
            <span className="mc-chip text-[0.58rem] text-[var(--text-muted)]">
              {rows.length}
            </span>
          </div>
          {rows.length === 0 ? (
            <div className="p-6 text-sm text-[var(--text-muted)]">
              Пока пусто. Действия появятся здесь после первых изменений.
            </div>
          ) : (
            <ul className="divide-y-2 divide-black/40">
              {rows.map((row) => (
                <li key={row.id} className="flex flex-wrap items-start gap-2 px-3 py-2.5 text-sm">
                  <span className="mc-chip text-[0.55rem] text-[var(--mc-green-light)]">
                    {auditActionLabel(row.action)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-[var(--text-secondary)]">{row.details ?? "—"}</span>
                    {row.targetType && (
                      <span className="ml-2 font-mono text-[0.58rem] text-[var(--text-muted)]">
                        {row.targetType}
                        {row.targetId ? ` #${row.targetId}` : ""}
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-[0.6rem] text-[var(--text-muted)]">
                    {row.adminNickname}
                  </span>
                  <span className="font-mono text-[0.58rem] text-[var(--text-muted)]">
                    {new Date(row.createdAt).toLocaleString("ru-RU")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

export const metadata = {
  title: "Админка · аудит",
};
