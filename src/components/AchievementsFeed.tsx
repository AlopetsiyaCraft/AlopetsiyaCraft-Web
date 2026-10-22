"use client";

import { useEffect, useRef, useState } from "react";
import PlayerHead from "@/components/mc/PlayerHead";
import { Panel, PanelHead } from "@/components/mc/Panel";

interface Achievement {
  id: number;
  nickname: string;
  advancementId: string;
  title: string;
  description: string | null;
  frame: "task" | "goal" | "challenge";
  icon: string;
  createdAt: number;
  skinUrl: string | null;
}

/** Цвет рамки достижения: task — зелёная, goal — жёлтая, challenge — фиолетовая. */
const FRAME_COLORS: Record<Achievement["frame"], string> = {
  task: "var(--mc-green-light)",
  goal: "var(--mc-gold)",
  challenge: "#a855f7",
};

/**
 * «Последние достижения» — панель в правой колонке главной.
 * Лента медленно прокручивается вверх сама (rAF, ~18px/с); при наведении
 * мыши прокрутка ставится на паузу.
 */
export default function AchievementsFeed() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);

  async function fetchAchievements() {
    try {
      const res = await fetch("/api/achievements/latest?limit=24");
      if (res.ok) {
        const data = await res.json();
        setAchievements(data);
      }
    } catch (error) {
      console.error("Failed to fetch achievements:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/achievements/latest?limit=24");
        if (res.ok && !cancelled) {
          setAchievements(await res.json());
        }
      } catch (error) {
        console.error("Failed to fetch achievements:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    const interval = setInterval(() => {
      void fetchAchievements();
    }, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Медленная вертикальная прокрутка ленты.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      raf = requestAnimationFrame(step);
      if (pausedRef.current || el.scrollHeight <= el.clientHeight) return;
      const dt = Math.min(now - last, 100);
      last = now;
      el.scrollTop += (dt / 1000) * 14;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) {
        el.scrollTop = 0;
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <Panel className="overflow-hidden">
      <PanelHead
        title="Достижения"
        icon={
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
            <path strokeLinecap="square" d="M8 21h8m-4-4v4M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z" />
          </svg>
        }
        right={<span className="mc-chip text-[0.6rem]">live</span>}
      />

      <div
        ref={scrollRef}
        className="h-72 overflow-hidden p-2 custom-scrollbar"
        onMouseEnter={() => {
          pausedRef.current = true;
        }}
        onMouseLeave={() => {
          pausedRef.current = false;
        }}
      >
        {loading ? (
          <div className="py-6 text-center text-sm text-[var(--text-muted)]">Загрузка…</div>
        ) : achievements.length === 0 ? (
          <div className="py-6 text-center text-sm text-[var(--text-muted)]">Пока нет достижений</div>
        ) : (
          <ul className="space-y-1">
            {achievements.map((a) => (
              <li
                key={a.id}
                title={a.description ?? undefined}
                className="flex items-center gap-2.5 border-2 border-transparent px-1.5 py-1.5 transition-colors hover:border-black hover:bg-[var(--hover)]"
              >
                <PlayerHead skinUrl={a.skinUrl} nickname={a.nickname} size={30} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm leading-tight">
                    <span className="font-semibold">{a.nickname}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 shrink-0"
                      style={{ backgroundColor: FRAME_COLORS[a.frame] }}
                      aria-hidden
                    />
                    <span className="truncate text-xs text-[var(--text-secondary)]">{a.title}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}
