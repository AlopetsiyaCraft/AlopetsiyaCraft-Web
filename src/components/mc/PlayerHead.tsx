import { cn } from "@/lib/utils";

/**
 * Голова игрока из скина (кроп 8×8 лица + слой шляпы).
 *
 * Размер рамки и текстуры разделены: чёрная рамка — это padding внешнего
 * блока, поэтому лицо всегда видно целиком и не обрезается на 2px с каждой
 * стороны (раньше border входил в размер и срезал края).
 *
 * Позиционирование спрайта — в процентах (background-size: 800%), поэтому
 * компонент корректно масштабируется и в режиме `fill` (ширина родителя).
 */
export default function PlayerHead({
  skinUrl,
  nickname = "",
  size = 40,
  className,
  border = true,
  borderWidth = 2,
  fill = false,
}: {
  skinUrl?: string | null;
  nickname?: string;
  /** Размер внешнего квадрата в px (в режиме fill игнорируется ширина). */
  size?: number;
  className?: string;
  /** Показывать чёрную рамку. */
  border?: boolean;
  borderWidth?: number;
  /** Растянуть на ширину родителя с сохранением квадрата. */
  fill?: boolean;
}) {
  const padding = border ? borderWidth : 0;
  const inner = Math.max(size - padding * 2, 1);

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden",
        border && "bg-black",
        className
      )}
      style={{
        width: fill ? "100%" : size,
        height: fill ? undefined : size,
        aspectRatio: fill ? "1 / 1" : undefined,
        padding,
      }}
      title={nickname || undefined}
      aria-hidden
    >
      <div
        className={cn(
          "relative h-full w-full overflow-hidden",
          !skinUrl &&
            "flex items-center justify-center bg-[var(--card-alt)] font-bold text-[var(--text-secondary)]"
        )}
        style={{ fontSize: inner * 0.42 }}
      >
        {skinUrl ? (
          <>
            {/* базовый слой головы: тайл (8,8) из сетки 64×64 */}
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url(${skinUrl})`,
                backgroundSize: "800% 800%",
                backgroundPosition: "14.2857% 14.2857%",
                imageRendering: "pixelated",
              }}
            />
            {/* слой шляпы: тайл (40,8) */}
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url(${skinUrl})`,
                backgroundSize: "800% 800%",
                backgroundPosition: "71.4286% 14.2857%",
                imageRendering: "pixelated",
              }}
            />
          </>
        ) : (
          nickname[0]?.toUpperCase() || "?"
        )}
      </div>
    </div>
  );
}
