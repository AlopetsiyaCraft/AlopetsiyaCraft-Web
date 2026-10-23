import PlayerHead from "@/components/mc/PlayerHead";
import {
  STAT_CATEGORIES,
  formatStatValue,
} from "@/lib/stats";

interface Row {
  nickname: string;
  skinUrl: string | null;
  values: Map<string, number>;
}

const SHORT_LABELS: Record<string, string> = {
  deaths: "Смерти",
  mob_kills: "Мобы",
  player_kills: "PvP",
  blocks_mined: "Блоки",
  walk_one_cm: "Ходьба",
  damage_dealt: "Урон+",
  damage_taken: "Урон−",
  jumps: "Прыжки",
  play_time: "Время",
};

const COLOR_A = "#7dbb52";
const COLOR_B = "#f2c94c";

const CX = 180;
const CY = 168;
const R = 116;

function radarPoints(row: Row, a: Row, b: Row): string {
  return STAT_CATEGORIES.map((category, i) => {
    const value = row.values.get(category.key) ?? 0;
    const max = Math.max(1, a.values.get(category.key) ?? 0, b.values.get(category.key) ?? 0);
    const ratio = Math.max(0, Math.min(1, value / max));
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / STAT_CATEGORIES.length;
    const x = CX + Math.cos(angle) * R * ratio;
    const y = CY + Math.sin(angle) * R * ratio;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

function ringPoints(scale: number): string {
  return STAT_CATEGORIES.map((_, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / STAT_CATEGORIES.length;
    const x = CX + Math.cos(angle) * R * scale;
    const y = CY + Math.sin(angle) * R * scale;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

/** Радар и построчное сравнение двух игроков по всем категориям. */
export default function StatsCompare({
  rows,
  a,
  b,
  sortKey,
}: {
  rows: Row[];
  a: Row;
  b: Row;
  sortKey: string;
}) {
  return (
    <section className="mc-panel overflow-hidden">
      <div className="mc-head">
        <span className="min-w-0 flex-1 truncate">Сравнение игроков</span>
        <span className="mc-chip text-[0.58rem] text-[var(--text-muted)]">
          сырые значения
        </span>
      </div>

      <form
        method="get"
        className="flex flex-wrap items-end gap-2 border-b-2 border-black/40 p-3"
      >
        <input type="hidden" name="sort" value={sortKey} />
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-[0.58rem] uppercase tracking-[0.12em] text-[var(--text-muted)]">
          Игрок A
          <select name="a" defaultValue={a.nickname} className="mc-input py-1 text-xs">
            {rows.map((row) => (
              <option key={row.nickname} value={row.nickname}>
                {row.nickname}
              </option>
            ))}
          </select>
        </label>
        <span className="pb-1 font-mono text-xs text-[var(--text-muted)]">vs</span>
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-[0.58rem] uppercase tracking-[0.12em] text-[var(--text-muted)]">
          Игрок B
          <select name="b" defaultValue={b.nickname} className="mc-input py-1 text-xs">
            {rows.map((row) => (
              <option key={row.nickname} value={row.nickname}>
                {row.nickname}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="mc-btn mc-btn-primary px-3 py-1.5 text-xs">
          Сравнить
        </button>
      </form>

      <div className="grid grid-cols-1 gap-5 p-4 lg:grid-cols-[22rem_1fr]">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center justify-center gap-3 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 border border-black" style={{ backgroundColor: COLOR_A }} />
              <PlayerHead skinUrl={a.skinUrl} nickname={a.nickname} size={20} />
              <span className="truncate font-semibold">{a.nickname}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 border border-black" style={{ backgroundColor: COLOR_B }} />
              <PlayerHead skinUrl={b.skinUrl} nickname={b.nickname} size={20} />
              <span className="truncate font-semibold">{b.nickname}</span>
            </span>
          </div>

          <svg
            viewBox="0 0 360 336"
            className="mx-auto w-full max-w-[360px]"
            role="img"
            aria-label={`Сравнение ${a.nickname} и ${b.nickname}`}
          >
            {[0.25, 0.5, 0.75, 1].map((scale) => (
              <polygon
                key={scale}
                points={ringPoints(scale)}
                fill="none"
                stroke="rgba(255,255,255,0.18)"
                strokeWidth={1}
              />
            ))}
            {STAT_CATEGORIES.map((_, i) => {
              const angle = -Math.PI / 2 + (i * 2 * Math.PI) / STAT_CATEGORIES.length;
              return (
                <line
                  key={i}
                  x1={CX}
                  y1={CY}
                  x2={CX + Math.cos(angle) * R}
                  y2={CY + Math.sin(angle) * R}
                  stroke="rgba(255,255,255,0.14)"
                  strokeWidth={1}
                />
              );
            })}
            <polygon
              points={radarPoints(a, a, b)}
              fill="rgba(125,187,82,0.22)"
              stroke={COLOR_A}
              strokeWidth={2}
              strokeLinejoin="miter"
            />
            <polygon
              points={radarPoints(b, a, b)}
              fill="rgba(242,201,76,0.18)"
              stroke={COLOR_B}
              strokeWidth={2}
              strokeLinejoin="miter"
            />
            {STAT_CATEGORIES.map((category, i) => {
              const angle = -Math.PI / 2 + (i * 2 * Math.PI) / STAT_CATEGORIES.length;
              const x = CX + Math.cos(angle) * (R + 20);
              const y = CY + Math.sin(angle) * (R + 20);
              const anchor =
                Math.abs(x - CX) < 12 ? "middle" : x > CX ? "start" : "end";
              return (
                <text
                  key={category.key}
                  x={x}
                  y={y}
                  textAnchor={anchor}
                  dominantBaseline="middle"
                  fill="var(--text-secondary)"
                  fontSize={9}
                  fontFamily="var(--font-pixel), monospace"
                >
                  {SHORT_LABELS[category.key] ?? category.label}
                </text>
              );
            })}
          </svg>
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          {STAT_CATEGORIES.map((category) => {
            const aValue = a.values.get(category.key) ?? 0;
            const bValue = b.values.get(category.key) ?? 0;
            const max = Math.max(1, aValue, bValue);
            return (
              <div
                key={category.key}
                className="border-b-2 border-black/30 pb-2 last:border-b-0 last:pb-0"
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-[0.62rem] uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    {category.label}
                  </span>
                  <span className="font-mono text-[0.58rem] text-[var(--text-muted)]">
                    Δ{" "}
                    {formatStatValue(category, Math.abs(aValue - bValue))}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  {[
                    { row: a, value: aValue, color: COLOR_A },
                    { row: b, value: bValue, color: COLOR_B },
                  ].map((entry) => (
                    <div key={entry.row.nickname} className="flex items-center gap-2">
                      <div className="h-2.5 min-w-0 flex-1 border border-black bg-[var(--bg)]">
                        <div
                          className="h-full"
                          style={{
                            width: `${Math.max(1, (entry.value / max) * 100)}%`,
                            backgroundColor: entry.color,
                          }}
                        />
                      </div>
                      <span className="w-16 shrink-0 text-right font-mono text-[0.62rem] text-[var(--text-secondary)] sm:w-20">
                        {formatStatValue(category, entry.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
