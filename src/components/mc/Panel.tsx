import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Пиксельная панель в стиле инвентаря Minecraft:
 * чёрная рамка 2px, внутренние блики, жёсткая тень.
 */
export function Panel({
  children,
  className,
  flat,
}: {
  children: ReactNode;
  className?: string;
  flat?: boolean;
}) {
  return (
    <div className={cn(flat ? "mc-panel-flat" : "mc-panel", className)}>{children}</div>
  );
}

/** Шапка панели с заголовком-капсом и опциональным действием справа. */
export function PanelHead({
  title,
  icon,
  right,
  className,
}: {
  title: ReactNode;
  icon?: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mc-head", className)}>
      {icon ? <span className="flex shrink-0 items-center text-[var(--mc-green-light)]">{icon}</span> : null}
      <h2 className="min-w-0 flex-1 truncate text-[0.78rem] font-bold tracking-[0.12em] text-[var(--text)]">
        {title}
      </h2>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

/** Пиксельный «бейдж»/чип. */
export function Chip({
  children,
  className,
  tone = "default",
}: {
  children: ReactNode;
  className?: string;
  tone?: "default" | "green" | "gold" | "red" | "blue";
}) {
  const tones = {
    default: "text-[var(--text-secondary)]",
    green: "text-[var(--mc-green-light)]",
    gold: "text-[var(--mc-gold)]",
    red: "text-[var(--mc-red)]",
    blue: "text-[var(--mc-blue)]",
  } as const;

  return <span className={cn("mc-chip", tones[tone], className)}>{children}</span>;
}
