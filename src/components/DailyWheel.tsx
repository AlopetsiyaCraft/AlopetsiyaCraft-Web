"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DAILY_PRIZES,
  dailyPrizeLabel,
  type DailyPrizeKind,
} from "@/lib/dailyBonus";

interface SpinResult {
  index: number;
  kind: DailyPrizeKind;
  amount: number;
  bld: number;
  chips: number;
  nextSpinAt: number;
}

interface DailyWheelProps {
  isLoggedIn: boolean;
  initialBld: number;
  initialChips: number;
  /** Когда снова можно крутить (ms). null — можно прямо сейчас. */
  initialNextSpinAt: number | null;
}

const SEGMENT_ANGLE = 360 / DAILY_PRIZES.length;
const SPIN_TURNS = 5;
const SPIN_DURATION_MS = 4600;
const LOGIN_HREF = "/auth/login?callbackUrl=/shop";

/** 23:59:59 — таймер до следующей попытки. */
function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

/**
 * Угол, при котором сектор index окажется под верхним указателем.
 * Небольшой разброс внутри сектора, чтобы колесо не замирало всегда
 * строго по центру.
 */
function spinTarget(from: number, index: number): number {
  const jitter = (Math.random() - 0.5) * (SEGMENT_ANGLE - 24);
  const targetMod = (360 - index * SEGMENT_ANGLE + jitter + 360) % 360;
  const fromMod = ((from % 360) + 360) % 360;
  const delta = (targetMod - fromMod + 360) % 360;
  return from + delta + 360 * SPIN_TURNS;
}

/** Пиксельная монета BLD. */
function BldIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 12" className={className} shapeRendering="crispEdges" aria-hidden>
      <rect x="3" y="0" width="6" height="1" fill="#6b4f0e" />
      <rect x="1" y="1" width="10" height="1" fill="#6b4f0e" />
      <rect x="0" y="2" width="12" height="8" fill="#6b4f0e" />
      <rect x="1" y="10" width="10" height="1" fill="#6b4f0e" />
      <rect x="3" y="11" width="6" height="1" fill="#6b4f0e" />
      <rect x="3" y="1" width="6" height="1" fill="#f2c94c" />
      <rect x="2" y="2" width="8" height="1" fill="#f2c94c" />
      <rect x="1" y="3" width="10" height="6" fill="#f2c94c" />
      <rect x="2" y="9" width="8" height="1" fill="#f2c94c" />
      <rect x="3" y="10" width="6" height="1" fill="#f2c94c" />
      <rect x="3" y="2" width="3" height="1" fill="#ffe58a" />
      <rect x="2" y="3" width="2" height="2" fill="#ffe58a" />
      <rect x="4" y="3" width="1" height="6" fill="#6b4f0e" />
      <rect x="5" y="3" width="3" height="1" fill="#6b4f0e" />
      <rect x="5" y="5" width="2" height="1" fill="#6b4f0e" />
      <rect x="5" y="8" width="3" height="1" fill="#6b4f0e" />
      <rect x="7" y="4" width="1" height="1" fill="#6b4f0e" />
      <rect x="7" y="6" width="1" height="2" fill="#6b4f0e" />
    </svg>
  );
}

/** Пиксельная стопка фишек казино. */
function ChipsIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 12" className={className} shapeRendering="crispEdges" aria-hidden>
      <rect x="1" y="8" width="10" height="1" fill="#0d1b30" />
      <rect x="1" y="5" width="10" height="3" fill="#3f7fd1" />
      <rect x="2" y="4" width="8" height="1" fill="#4a90e2" />
      <rect x="2" y="6" width="1" height="1" fill="#dcecff" />
      <rect x="9" y="6" width="1" height="1" fill="#dcecff" />
      <rect x="1" y="4" width="10" height="1" fill="#101c30" />
      <rect x="1" y="1" width="10" height="3" fill="#8b5cf6" />
      <rect x="3" y="1" width="1" height="3" fill="#e9d5ff" />
      <rect x="7" y="1" width="1" height="3" fill="#e9d5ff" />
    </svg>
  );
}

function PrizeIcon({
  kind,
  className,
}: {
  kind: DailyPrizeKind;
  className?: string;
}) {
  return kind === "bld" ? <BldIcon className={className} /> : <ChipsIcon className={className} />;
}

/** Колесо ежедневного бонуса на экране магазина. */
export default function DailyWheel({
  isLoggedIn,
  initialBld,
  initialChips,
  initialNextSpinAt,
}: DailyWheelProps) {
  const router = useRouter();

  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [bld, setBld] = useState(initialBld);
  const [chips, setChips] = useState(initialChips);
  const [nextSpinAt, setNextSpinAt] = useState<number | null>(initialNextSpinAt);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pendingRef = useRef<SpinResult | null>(null);
  const fallbackRef = useRef<number | null>(null);

  const reveal = useCallback(() => {
    const data = pendingRef.current;
    if (!data) return;
    pendingRef.current = null;
    if (fallbackRef.current !== null) {
      window.clearTimeout(fallbackRef.current);
      fallbackRef.current = null;
    }
    setResult(data);
    setSpinning(false);
    setBld(data.bld);
    setChips(data.chips);
    setNextSpinAt(data.nextSpinAt);
    // Обновляем баланс в шапке (она серверная).
    router.refresh();
  }, [router]);

  // Чистим страховочный таймер при размонтировании.
  useEffect(() => {
    return () => {
      if (fallbackRef.current !== null) window.clearTimeout(fallbackRef.current);
    };
  }, []);

  // Отсчёт считаем на клиенте: на сервере и в браузере время разное,
  // иначе получим расхождение при гидратации.
  useEffect(() => {
    if (!nextSpinAt) return;
    function tick() {
      const left = (nextSpinAt as number) - Date.now();
      if (left <= 0) {
        setRemaining(0);
        setNextSpinAt(null);
      } else {
        setRemaining(left);
      }
    }
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [nextSpinAt]);

  // Страховка: если transitionend не дошёл (вкладка была свёрнута и т.п.),
  // показываем результат по таймеру. Отсчёт стартует вместе с анимацией,
  // а не с запросом — иначе медленная сеть оборвёт её раньше времени.
  // (Таймер ставится в spin() сразу после setRotation.)

  async function spin() {
    if (!isLoggedIn || spinning || nextSpinAt) return;
    setError(null);
    setResult(null);
    setSpinning(true);

    try {
      const res = await fetch("/api/daily-bonus/spin", { method: "POST" });
      const data = (await res.json()) as SpinResult & { error?: string };

      if (!res.ok || typeof data.index !== "number") {
        if (typeof data.nextSpinAt === "number") setNextSpinAt(data.nextSpinAt);
        throw new Error(data.error || "Не удалось прокрутить колесо");
      }

      pendingRef.current = data;
      setRotation((prev) => spinTarget(prev, data.index));

      if (fallbackRef.current !== null) window.clearTimeout(fallbackRef.current);
      fallbackRef.current = window.setTimeout(reveal, SPIN_DURATION_MS + 900);
    } catch (e) {
      setSpinning(false);
      setError(e instanceof Error ? e.message : "Ошибка сети");
    }
  }

  const wheelBackground = useMemo(() => {
    const colors = DAILY_PRIZES.map((_, i) => (i % 2 === 0 ? "#5d9c3c" : "#26331d"));
    return `conic-gradient(from -${SEGMENT_ANGLE / 2}deg, ${colors
      .map((color, i) => `${color} ${i * SEGMENT_ANGLE}deg ${(i + 1) * SEGMENT_ANGLE}deg`)
      .join(", ")})`;
  }, []);

  const available = isLoggedIn && !spinning && !nextSpinAt;
  const winnerIndex = result?.index ?? null;

  return (
    <section className="mc-panel overflow-hidden">
      <div className="mc-head">
        <span className="flex h-5 w-5 items-center justify-center bg-[var(--mc-gold)] text-[0.7rem] leading-none text-[#3a2c06]">
          ★
        </span>
        Ежедневный бонус
        <span className="ml-auto flex items-center gap-1.5 text-[0.6rem] font-normal normal-case tracking-normal text-[var(--text-muted)]">
          <span className="mc-chip px-1.5 py-0 text-[0.55rem]">раз в 24 часа</span>
        </span>
      </div>

      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,24rem)_1fr] lg:items-center lg:gap-10">
        {/* Колесо */}
        <div className="mx-auto w-full max-w-[21rem] select-none sm:max-w-[23rem]">
          <div className="relative aspect-square">
            {/* Указатель */}
            <div className="pointer-events-none absolute left-1/2 top-0 z-30 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-black bg-[var(--mc-gold)] shadow-[0_4px_0_rgba(0,0,0,0.45)]">
              <span className="mt-0.5 block h-0 w-0 border-x-[8px] border-t-[11px] border-x-transparent border-t-[#3a2c06]" />
            </div>

            {/* Вращающееся полотно */}
            <div
              className="mc-wheel absolute inset-0 overflow-hidden rounded-full border-[3px] border-black shadow-[0_0_0_4px_rgba(0,0,0,0.35),inset_0_0_36px_rgba(0,0,0,0.45)]"
              style={{ background: wheelBackground, transform: `rotate(${rotation}deg)` }}
              onTransitionEnd={(e) => {
                if (e.propertyName === "transform" && e.target === e.currentTarget) reveal();
              }}
            >
              {/* Тонкие тёмные линии между секторами */}
              <div
                className="pointer-events-none absolute inset-0 rounded-full"
                style={{
                  background:
                    "repeating-conic-gradient(from -22.5deg, transparent 0deg 43.6deg, rgba(0,0,0,0.55) 43.6deg 45deg)",
                }}
              />

              {DAILY_PRIZES.map((prize, i) => (
                <div
                  key={i}
                  className="absolute inset-0"
                  style={{ transform: `rotate(${i * SEGMENT_ANGLE}deg)` }}
                >
                  <div
                    className={`absolute left-1/2 top-[13%] flex w-[4.5rem] -translate-x-1/2 flex-col items-center gap-0.5 text-center sm:w-20 ${
                      i % 2 === 0 ? "text-[#0e2207]" : "text-[#e8f6dd]"
                    }`}
                  >
                    <PrizeIcon
                      kind={prize.kind}
                      className={`h-4 w-4 sm:h-5 sm:w-5 ${
                        winnerIndex === i ? "mc-wheel-win" : ""
                      }`}
                    />
                    <span className="text-[0.52rem] font-bold leading-[1.15] tracking-tight sm:text-[0.6rem]">
                      {dailyPrizeLabel(prize)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Ступица */}
            <div className="absolute inset-0 z-20 flex items-center justify-center">
              {isLoggedIn ? (
                <button
                  type="button"
                  onClick={spin}
                  disabled={!available}
                  style={!available ? { opacity: 0.82 } : undefined}
                  className="mc-btn mc-btn-primary flex h-[4.5rem] w-[4.5rem] flex-col items-center justify-center gap-0.5 rounded-full p-0 text-center leading-none shadow-[0_5px_0_rgba(0,0,0,0.55)] sm:h-20 sm:w-20"
                  title={
                    spinning
                      ? "Колесо крутится"
                      : nextSpinAt
                        ? "Следующая попытка позже"
                        : "Крутить колесо"
                  }
                >
                  <span className="text-[0.62rem] font-bold tracking-[0.04em]">
                    {spinning ? "…" : nextSpinAt ? "ЖДИ" : "КРУТИТЬ"}
                  </span>
                  {!spinning && !nextSpinAt && (
                    <span className="text-[0.45rem] font-normal opacity-80">1 прокрут</span>
                  )}
                </button>
              ) : (
                <Link
                  href={LOGIN_HREF}
                  className="mc-btn mc-btn-primary flex h-[4.5rem] w-[4.5rem] flex-col items-center justify-center rounded-full p-0 text-[0.6rem] leading-none sm:h-20 sm:w-20"
                >
                  ВОЙТИ
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Текст и статус */}
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="mc-title text-2xl sm:text-3xl">Крути и забирай</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">
              Один бесплатный прокрут в сутки. Внутри — болды на покупки на сайте и
              фишки для казино в Minecraft.
            </p>
          </div>

          {!isLoggedIn && (
            <p className="text-sm text-[var(--text-muted)]">
              Войди в аккаунт, чтобы крутить колесо и забирать призы.
            </p>
          )}

          {result && (
            <div className="mc-inset flex items-center gap-3 p-3" role="status">
              <span className="mc-panel-flat flex h-11 w-11 shrink-0 items-center justify-center">
                <PrizeIcon kind={result.kind} className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <div className="text-[0.58rem] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                  Выпало
                </div>
                <div className="font-mono text-xl leading-tight text-[var(--mc-gold)]">
                  +{dailyPrizeLabel(result)}
                </div>
                <div className="text-[0.6rem] text-[var(--text-muted)]">Уже на балансе</div>
              </div>
            </div>
          )}

          {error && (
            <p className="border-2 border-black bg-[rgba(214,69,69,0.16)] px-3 py-2 text-sm text-[var(--mc-red)]">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            {!isLoggedIn ? (
              <Link href={LOGIN_HREF} className="mc-btn mc-btn-primary">
                Войти и крутить
              </Link>
            ) : spinning ? (
              <button type="button" disabled className="mc-btn mc-btn-primary">
                Крутим…
              </button>
            ) : nextSpinAt ? (
              <div className="mc-inset flex items-center gap-2 px-3 py-2">
                <span className="text-[0.58rem] uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  Следующая
                  <br />
                  попытка через
                </span>
                <span className="font-mono text-lg leading-none text-[var(--mc-green-light)]">
                  {remaining === null ? "--:--:--" : formatCountdown(remaining)}
                </span>
              </div>
            ) : (
              <button type="button" onClick={spin} className="mc-btn mc-btn-primary">
                Крутить колесо
              </button>
            )}
          </div>

          {isLoggedIn && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.68rem] text-[var(--text-muted)]">
              <span>
                На балансе:{" "}
                <b className="font-mono text-[var(--text)]">
                  {bld.toLocaleString("ru-RU")} BLD
                </b>
              </span>
              <span>
                <b className="font-mono text-[var(--text)]">
                  {chips.toLocaleString("ru-RU")}
                </b>{" "}
                фишек
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
