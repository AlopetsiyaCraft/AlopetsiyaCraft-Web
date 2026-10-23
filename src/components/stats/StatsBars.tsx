import Link from "next/link";
import PlayerHead from "@/components/mc/PlayerHead";
import { formatStatValue, getStatCategory } from "@/lib/stats";

interface Row {
  nickname: string;
  skinUrl: string | null;
  values: Map<string, number>;
}

const MEDALS = ["#f2c94c", "#c9c9c9", "#c98b4b"];

/** Горизонтальный пиксельный график топ-10 по выбранной категории. */
export default function StatsBars({
  rows,
  sortKey,
}: {
  rows: Row[];
  sortKey: string;
}) {
  const category = getStatCategory(sortKey);
  if (!category) return null;

  const top = rows.slice(0, 10);
  const max = Math.max(1, ...top.map((row) => row.values.get(sortKey) ?? 0));

  return (
    <section className="mc-panel overflow-hidden">
      <div className="mc-head">
        <span className="min-w-0 flex-1 truncate">График · {category.label}</span>
        <span className="mc-chip text-[0.6rem] text-[var(--text-muted)]">топ-10</span>
      </div>
      <div className="flex flex-col gap-2 p-3">
        {top.map((row, index) => {
          const value = row.values.get(sortKey) ?? 0;
          const width = Math.max(1.5, (value / max) * 100);
          return (
            <div key={row.nickname} className="flex items-center gap-2">
              <span
                className="w-5 shrink-0 text-center font-mono text-[0.62rem] text-[var(--text-muted)]"
                style={index < 3 ? { color: MEDALS[index] } : undefined}
              >
                {index + 1}
              </span>
              <PlayerHead skinUrl={row.skinUrl} nickname={row.nickname} size={24} />
              <Link
                href={`/profile/${encodeURIComponent(row.nickname)}`}
                className="w-24 shrink-0 truncate text-xs font-semibold hover:text-[var(--mc-green-light)] sm:w-32"
              >
                {row.nickname}
              </Link>
              <div className="relative h-4 min-w-0 flex-1 border-2 border-black bg-[var(--bg)]">
                <div
                  className="h-full"
                  style={{
                    width: `${width}%`,
                    backgroundColor:
                      index < 3 ? MEDALS[index] : "var(--mc-green-dark)",
                    boxShadow: "inset -2px -2px 0 rgba(0,0,0,0.35)",
                  }}
                />
              </div>
              <span className="w-16 shrink-0 text-right font-mono text-[0.68rem] text-[var(--text-secondary)] sm:w-24">
                {formatStatValue(category, value)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
