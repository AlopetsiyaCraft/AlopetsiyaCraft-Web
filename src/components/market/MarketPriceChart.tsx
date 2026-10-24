interface ChartPoint {
  priceBld: number;
  createdAt: number;
}

function shortDate(ms: number) {
  return new Date(ms).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
}

/** Пиксельный график цены по последним сделкам (без внешних библиотек). */
export default function MarketPriceChart({ sales }: { sales: ChartPoint[] }) {
  if (sales.length === 0) {
    return (
      <div className="mc-inset flex h-[220px] items-center justify-center text-sm text-[var(--text-muted)]">
        Продаж пока не было — графика нет.
      </div>
    );
  }

  const ordered = [...sales].sort((a, b) => a.createdAt - b.createdAt);
  const W = 600;
  const H = 220;
  const PAD_X = 36;
  const PAD_Y = 24;

  const prices = ordered.map((sale) => sale.priceBld);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = Math.max(1, max - min);
  const low = Math.max(0, min - span * 0.15);
  const high = max + span * 0.15;

  const xFor = (index: number) =>
    ordered.length === 1
      ? W / 2
      : PAD_X + (index / (ordered.length - 1)) * (W - PAD_X * 2);
  const yFor = (price: number) =>
    H - PAD_Y - ((price - low) / (high - low)) * (H - PAD_Y * 2);

  const line = ordered.map((sale, index) => `${xFor(index).toFixed(1)},${yFor(sale.priceBld).toFixed(1)}`).join(" ");
  const area = `${PAD_X},${H - PAD_Y} ${line} ${W - PAD_X},${H - PAD_Y}`;

  const gridPrices = [min, Math.round((min + max) / 2), max];

  return (
    <div className="flex flex-col gap-1">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="График цены предмета"
      >
        {gridPrices.map((price) => (
          <g key={price}>
            <line
              x1={PAD_X}
              y1={yFor(price)}
              x2={W - PAD_X}
              y2={yFor(price)}
              stroke="rgba(255,255,255,0.12)"
              strokeWidth={1}
            />
            <text
              x={4}
              y={yFor(price)}
              dominantBaseline="middle"
              fill="var(--text-muted)"
              fontSize={9}
              fontFamily="var(--font-pixel), monospace"
            >
              {price}
            </text>
          </g>
        ))}

        <polygon points={area} fill="rgba(125,187,82,0.16)" />
        <polyline
          points={line}
          fill="none"
          stroke="var(--mc-green-light)"
          strokeWidth={2}
          strokeLinejoin="miter"
        />
        {ordered.map((sale, index) => (
          <circle
            key={`${sale.createdAt}-${index}`}
            cx={xFor(index)}
            cy={yFor(sale.priceBld)}
            r={2.5}
            fill="var(--mc-gold)"
          />
        ))}
      </svg>
      <div className="flex justify-between px-1 font-mono text-[0.55rem] text-[var(--text-muted)]">
        <span>{shortDate(ordered[0].createdAt)}</span>
        <span>{ordered.length} сделок</span>
        <span>{shortDate(ordered[ordered.length - 1].createdAt)}</span>
      </div>
    </div>
  );
}
