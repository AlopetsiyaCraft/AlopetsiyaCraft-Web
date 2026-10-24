import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  seasonEvents,
  seasonResults,
  seasonRewards,
  seasons,
} from "@/lib/db/schema";
import PlayerHead from "@/components/mc/PlayerHead";

function formatDate(value: number | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/** /seasons/<n>/results — таймлайн, награды и итоги сезона. */
export default async function SeasonResultsPage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number } = await params;
  const seasonNumber = parseInt(number, 10);
  if (!Number.isFinite(seasonNumber)) notFound();

  const season = await db
    .select()
    .from(seasons)
    .where(eq(seasons.number, seasonNumber))
    .get();
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
      .orderBy(asc(seasonRewards.place), asc(seasonRewards.id))
      .all(),
    db
      .select()
      .from(seasonResults)
      .where(eq(seasonResults.seasonId, season.id))
      .orderBy(asc(seasonResults.place))
      .all(),
  ]);

  const totalBld = rewards.reduce((sum, reward) => sum + reward.rewardBld, 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="mc-title text-2xl">Итоги сезона</h2>
        {season.isActive ? (
          <span className="mc-chip text-[0.6rem] text-[var(--mc-green-light)]">
            Сезон идёт
          </span>
        ) : (
          <span className="mc-chip text-[0.6rem] text-[var(--text-muted)]">Архив</span>
        )}
      </div>

      <section className="mc-panel overflow-hidden">
        <div className="mc-head">
          <span className="min-w-0 flex-1 truncate">Таймлайн</span>
          <span className="mc-chip text-[0.58rem] text-[var(--text-muted)]">
            {events.length}
          </span>
        </div>
        {events.length === 0 ? (
          <div className="p-6 text-sm text-[var(--text-muted)]">
            События сезона ещё не добавлены.
          </div>
        ) : (
          <ol className="relative flex flex-col gap-0 p-4">
            {events.map((event, index) => (
              <li key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
                <div className="flex flex-col items-center">
                  <span className="mc-inset flex h-8 w-8 shrink-0 items-center justify-center text-sm">
                    {event.icon || "📌"}
                  </span>
                  {index < events.length - 1 && (
                    <span className="mt-1 w-0.5 flex-1 bg-[var(--border-soft)]" />
                  )}
                </div>
                <div className="min-w-0 flex-1 border-b-2 border-black/30 pb-3 last:border-b-0 last:pb-0">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-sm font-semibold">{event.title}</span>
                    <span className="font-mono text-[0.58rem] text-[var(--mc-green-light)]">
                      {formatDate(event.startsAt)}
                      {event.endsAt ? ` — ${formatDate(event.endsAt)}` : ""}
                    </span>
                  </div>
                  {event.description && (
                    <p className="mt-0.5 whitespace-pre-line text-xs text-[var(--text-secondary)]">
                      {event.description}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="mc-panel overflow-hidden">
        <div className="mc-head">
          <span className="min-w-0 flex-1 truncate">Награды</span>
          <span className="mc-chip text-[0.58rem] text-[var(--mc-gold)]">
            {totalBld > 0 ? `${totalBld.toLocaleString("ru-RU")} BLD` : "—"}
          </span>
        </div>
        {rewards.length === 0 ? (
          <div className="p-6 text-sm text-[var(--text-muted)]">
            Награды ещё не объявлены.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-px bg-black/40 sm:grid-cols-2 lg:grid-cols-3">
            {rewards.map((reward) => (
              <div key={reward.id} className="flex flex-col gap-1 bg-[var(--card)] p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{reward.title}</span>
                  {reward.place != null && (
                    <span className="mc-chip text-[0.55rem] text-[var(--mc-gold)]">
                      {reward.place} место
                    </span>
                  )}
                </div>
                {reward.description && (
                  <p className="text-xs text-[var(--text-secondary)]">{reward.description}</p>
                )}
                <div className="mt-auto flex flex-wrap gap-2 pt-1 font-mono text-[0.65rem]">
                  {reward.rewardBld > 0 && (
                    <span className="text-[var(--mc-gold)]">
                      {reward.rewardBld.toLocaleString("ru-RU")} BLD
                    </span>
                  )}
                  {reward.rewardChips > 0 && (
                    <span className="text-[var(--mc-green-light)]">
                      {reward.rewardChips.toLocaleString("ru-RU")} фишек
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mc-panel overflow-hidden">
        <div className="mc-head">Победители</div>
        {results.length === 0 ? (
          <div className="p-6 text-sm text-[var(--text-muted)]">
            {season.isActive
              ? "Сезон ещё идёт — итоги появятся после финала."
              : "Итоги сезона ещё не внесены."}
          </div>
        ) : (
          <ul className="divide-y-2 divide-black/40">
            {results.map((result) => (
              <li key={result.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                <span
                  className="w-8 shrink-0 text-center font-mono text-sm"
                  style={
                    result.place <= 3
                      ? { color: ["#f2c94c", "#c9c9c9", "#c98b4b"][result.place - 1] }
                      : undefined
                  }
                >
                  #{result.place}
                </span>
                <PlayerHead skinUrl={null} nickname={result.nickname} size={28} />
                <Link
                  href={`/profile/${encodeURIComponent(result.nickname)}`}
                  className="min-w-0 flex-1 truncate text-sm font-semibold hover:text-[var(--mc-green-light)]"
                >
                  {result.nickname}
                </Link>
                {result.note && (
                  <span className="text-xs text-[var(--text-muted)]">{result.note}</span>
                )}
                <span className="font-mono text-xs text-[var(--mc-gold)]">
                  {result.rewardBld > 0 ? `${result.rewardBld} BLD` : ""}
                  {result.rewardBld > 0 && result.rewardChips > 0 ? " · " : ""}
                  {result.rewardChips > 0 ? `${result.rewardChips} фишек` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export const metadata = {
  title: "Итоги сезона",
};
