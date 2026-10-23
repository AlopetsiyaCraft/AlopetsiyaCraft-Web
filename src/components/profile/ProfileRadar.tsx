import { STAT_CATEGORIES } from "@/lib/stats";

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

const CX = 180;
const CY = 158;
const R = 108;
const SIZE = 360;
const HEIGHT = 316;

function points(ratioFor: (index: number) => number): string {
  return STAT_CATEGORIES.map((_, index) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / STAT_CATEGORIES.length;
    const ratio = Math.max(0, Math.min(1, ratioFor(index)));
    const x = CX + Math.cos(angle) * R * ratio;
    const y = CY + Math.sin(angle) * R * ratio;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

function ring(scale: number): string {
  return STAT_CATEGORIES.map((_, index) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / STAT_CATEGORIES.length;
    return `${(CX + Math.cos(angle) * R * scale).toFixed(1)},${(CY + Math.sin(angle) * R * scale).toFixed(1)}`;
  }).join(" ");
}

/** Пиксельный радар игрока: значения нормируются на рекорд сервера. */
export default function ProfileRadar({
  values,
  maxByCategory,
}: {
  values: Record<string, number>;
  maxByCategory: Record<string, number>;
}) {
  return (
    <svg
      viewBox={`0 0 ${SIZE} ${HEIGHT}`}
      className="mx-auto w-full max-w-[360px]"
      role="img"
      aria-label="Радар статистики игрока"
    >
      {[0.25, 0.5, 0.75, 1].map((scale) => (
        <polygon
          key={scale}
          points={ring(scale)}
          fill="none"
          stroke="rgba(255,255,255,0.16)"
          strokeWidth={1}
        />
      ))}
      {STAT_CATEGORIES.map((_, index) => {
        const angle = -Math.PI / 2 + (index * 2 * Math.PI) / STAT_CATEGORIES.length;
        return (
          <line
            key={index}
            x1={CX}
            y1={CY}
            x2={CX + Math.cos(angle) * R}
            y2={CY + Math.sin(angle) * R}
            stroke="rgba(255,255,255,0.12)"
            strokeWidth={1}
          />
        );
      })}
      <polygon
        points={points((index) => {
          const category = STAT_CATEGORIES[index];
          const value = values[category.key] ?? 0;
          return value / Math.max(1, maxByCategory[category.key] ?? 1);
        })}
        fill="rgba(125,187,82,0.22)"
        stroke="var(--mc-green-light)"
        strokeWidth={2}
        strokeLinejoin="miter"
      />
      {STAT_CATEGORIES.map((category, index) => {
        const angle = -Math.PI / 2 + (index * 2 * Math.PI) / STAT_CATEGORIES.length;
        const x = CX + Math.cos(angle) * (R + 18);
        const y = CY + Math.sin(angle) * (R + 18);
        const anchor = Math.abs(x - CX) < 12 ? "middle" : x > CX ? "start" : "end";
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
  );
}
