import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { getAdminUser } from "@/lib/admin";
import { db } from "@/lib/db";
import { seasonEvents, seasonResults, seasonRewards, seasons, users } from "@/lib/db/schema";
import Header from "@/components/Header";
import SeasonExtrasAdmin from "../SeasonExtrasAdmin";

/** /admin/seasons/<номер> — таймлайн, награды и итоги сезона. */
export default async function AdminSeasonExtrasPage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const admin = await getAdminUser();
  if (!admin) {
    redirect("/auth/login?callbackUrl=%2Fadmin%2Fseasons");
  }

  const { number } = await params;
  const seasonNumber = parseInt(number, 10);
  if (!Number.isFinite(seasonNumber)) notFound();

  const [season, allSeasons, me] = await Promise.all([
    db.select().from(seasons).where(eq(seasons.number, seasonNumber)).get(),
    db.select().from(seasons).orderBy(desc(seasons.number)).all(),
    db
      .select({ name: users.nickname, skinUrl: users.skinUrl, bld: users.bld })
      .from(users)
      .where(eq(users.id, admin.id))
      .get(),
  ]);
  if (!season) notFound();

  const [events, rewards, results] = await Promise.all([
    db
      .select()
      .from(seasonEvents)
      .where(eq(seasonEvents.seasonId, season.id))
      .orderBy(asc(seasonEvents.startsAt))
      .all(),
    db
      .select()
      .from(seasonRewards)
      .where(eq(seasonRewards.seasonId, season.id))
      .orderBy(asc(seasonRewards.place))
      .all(),
    db
      .select()
      .from(seasonResults)
      .where(eq(seasonResults.seasonId, season.id))
      .orderBy(asc(seasonResults.place))
      .all(),
  ]);

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
            <h1 className="mc-title text-3xl">Сезон {season.number}</h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {season.name}: события, награды и победители.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href={`/seasons/${season.number}/results`} className="mc-btn px-3 py-1.5 text-xs">
              Открыть на сайте
            </Link>
            <Link href="/admin/seasons" className="mc-btn px-3 py-1.5 text-xs">
              ← К сезонам
            </Link>
          </div>
        </div>

        <SeasonExtrasAdmin
          seasonId={season.id}
          events={events.map((event) => ({
            id: event.id,
            title: event.title,
            description: event.description,
            startsAt: event.startsAt.toISOString(),
            endsAt: event.endsAt ? event.endsAt.toISOString() : null,
            icon: event.icon,
          }))}
          rewards={rewards.map((reward) => ({
            id: reward.id,
            title: reward.title,
            description: reward.description,
            place: reward.place,
            rewardBld: reward.rewardBld,
            rewardChips: reward.rewardChips,
          }))}
          results={results.map((result) => ({
            id: result.id,
            place: result.place,
            nickname: result.nickname,
            note: result.note,
            rewardBld: result.rewardBld,
            rewardChips: result.rewardChips,
          }))}
        />

        <p className="mt-4 text-xs text-[var(--text-muted)]">
          Награды и итоги здесь — витрина. BLD и фишки победителям начисляются
          отдельно в разделе «Экономика» или вручную.
        </p>
      </main>
    </div>
  );
}

export const metadata = {
  title: "Админка · сезон",
};
