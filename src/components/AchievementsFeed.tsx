"use client";

import { useEffect, useRef, useState } from "react";

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
  task: "#22c55e",
  goal: "#eab308",
  challenge: "#a855f7",
};

/** Голова игрока из скина — такой же CSS-кроп, как в списке игроков. */
function AchievementHead({ skinUrl, nickname }: { skinUrl: string | null; nickname: string }) {
  if (!skinUrl) {
    return (
      <div className="w-10 h-10 bg-[#7c3aed] rounded flex items-center justify-center text-sm font-bold flex-shrink-0">
        {nickname[0]?.toUpperCase() || "?"}
      </div>
    );
  }

  return (
    <div className="w-10 h-10 rounded relative overflow-hidden flex-shrink-0">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${skinUrl})`,
          backgroundSize: "320px 320px",
          backgroundPosition: "-40px -40px",
          imageRendering: "pixelated",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${skinUrl})`,
          backgroundSize: "320px 320px",
          backgroundPosition: "-200px -40px",
          imageRendering: "pixelated",
        }}
      />
    </div>
  );
}

/**
 * «Последние достижения» — карточка в правой колонке главной (как список
 * игроков): голова игрока, кто получил, справа название достижения.
 * Лента медленно прокручивается вверх сама (rAF, ~18px/с); при наведении
 * мыши прокрутка ставится на паузу. Если достижений больше нет — стоп.
 */
export default function AchievementsFeed() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);

  async function fetchAchievements() {
    try {
      const res = await fetch("/api/achievements/latest?limit=20");
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
        const res = await fetch("/api/achievements/latest?limit=20");
        if (res.ok && !cancelled) {
          const data = await res.json();
          setAchievements(data);
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
      // На паузе при наведении; не скроллим, если контент помещается целиком.
      if (pausedRef.current || el.scrollHeight <= el.clientHeight) return;
      // dt ограничиваем: если вкладка была фоновой, кадр не должен «телепортировать» ленту.
      const dt = Math.min(now - last, 100);
      last = now;
      el.scrollTop += (dt / 1000) * 18;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) {
        el.scrollTop = 0;
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--border)]">
        <h2 className="font-semibold">Достижения</h2>
      </div>

      <div
        ref={scrollRef}
        className="p-4 h-72 overflow-hidden"
        onMouseEnter={() => {
          pausedRef.current = true;
        }}
        onMouseLeave={() => {
          pausedRef.current = false;
        }}
      >
        {loading ? (
          <div className="text-center text-[var(--text-muted)] py-4">Загрузка...</div>
        ) : achievements.length === 0 ? (
          <div className="text-center text-[var(--text-muted)] py-4">Пока нет достижений</div>
        ) : (
          <div className="space-y-1">
            {achievements.map((a) => (
              <div
                key={a.id}
                title={a.description ?? undefined}
                className="flex items-center gap-3 p-2 rounded-lg"
              >
                <AchievementHead skinUrl={a.skinUrl} nickname={a.nickname} />
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm">
                    <span className="font-medium">{a.nickname}</span>
                    <span className="text-[var(--text-muted)] text-xs"> получил достижение</span>
                  </div>
                </div>
                <div className="flex-shrink-0 max-w-[45%] min-w-0">
                  <div className="flex items-center justify-end gap-1.5">
                    <span
                      className="w-1.5 h-4 rounded-full shrink-0"
                      style={{ backgroundColor: FRAME_COLORS[a.frame] }}
                      aria-hidden
                    />
                    <span className="text-xs text-[var(--text-secondary)] truncate">{a.title}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}