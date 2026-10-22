"use client";

import { useEffect, useRef, useState } from "react";
import { usePlayer } from "./PlayerContext";

const POS_KEY = "mc-player-pos";

interface Position {
  x: number;
  y: number;
}

function readSavedPosition(): Position | null {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Position>;
    if (typeof parsed.x !== "number" || typeof parsed.y !== "number") return null;
    return { x: parsed.x, y: parsed.y };
  } catch {
    return null;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(max, min));
}

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function MusicIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
    </svg>
  );
}

/** Точек-«ручка», чтобы было видно, что шапку можно тянуть. */
function GripIcon() {
  return (
    <svg className="w-3 h-4 text-[var(--text-muted)]" viewBox="0 0 8 16" fill="currentColor" aria-hidden>
      <circle cx="2" cy="3" r="1" />
      <circle cx="6" cy="3" r="1" />
      <circle cx="2" cy="8" r="1" />
      <circle cx="6" cy="8" r="1" />
      <circle cx="2" cy="13" r="1" />
      <circle cx="6" cy="13" r="1" />
    </svg>
  );
}

function PlayIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M8 5.5v13l11-6.5-11-6.5z" />
    </svg>
  );
}

function PauseIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
    </svg>
  );
}

function PrevIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M6 5h2v14H6zM20 5.5v13L9.5 12 20 5.5z" />
    </svg>
  );
}

function NextIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M16 5h2v14h-2zM4 5.5v13L14.5 12 4 5.5z" />
    </svg>
  );
}

function ShuffleIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
    </svg>
  );
}

function RepeatIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/**
 * Мини-плеер сайта: перетаскивается за шапку, переживает переходы между
 * страницами (живёт в корневом layout), умеет перемотку, повтор и перемешивание.
 */
export default function MiniPlayer() {
  const player = usePlayer();
  const { track, playing, currentTime, duration, repeat, shuffle, error } = player;

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const [pos, setPos] = useState<Position | null>(readSavedPosition);
  const [dragging, setDragging] = useState(false);

  const [draft, setDraft] = useState<number | null>(null);
  const [seeking, setSeeking] = useState(false);
  const draftRef = useRef<number | null>(null);
  const seekRef = useRef(player.seek);

  useEffect(() => {
    seekRef.current = player.seek;
  }, [player.seek]);

  // Держим позицию в пределах окна (после ресайза/смены монитора).
  useEffect(() => {
    function clampToViewport() {
      setPos((prev) => {
        if (!prev) return prev;
        const el = wrapRef.current;
        if (!el) return prev;
        const x = clamp(prev.x, 0, window.innerWidth - el.offsetWidth);
        const y = clamp(prev.y, 0, window.innerHeight - el.offsetHeight);
        return x === prev.x && y === prev.y ? prev : { x, y };
      });
    }
    clampToViewport();
    window.addEventListener("resize", clampToViewport);
    return () => window.removeEventListener("resize", clampToViewport);
  }, []);

  // Запоминаем позицию (но не в процессе перетаскивания).
  useEffect(() => {
    if (!pos || dragging) return;
    try {
      localStorage.setItem(POS_KEY, JSON.stringify(pos));
    } catch {
      // localStorage может быть недоступен — не критично.
    }
  }, [pos, dragging]);

  // Отпускание мыши/пальца в любом месте завершает перемотку.
  useEffect(() => {
    if (!seeking) return;
    function finish() {
      const value = draftRef.current;
      draftRef.current = null;
      setDraft(null);
      setSeeking(false);
      if (value != null) seekRef.current(value);
    }
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
    return () => {
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
    };
  }, [seeking]);

  function onDragStart(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button")) return;
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: rect.left, origY: rect.top };
    setPos({ x: rect.left, y: rect.top });
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Синтетические события/старые браузеры — перетаскивание работает и без capture.
    }
  }

  function onDragMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    const el = wrapRef.current;
    if (!d || !el) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!dragging && Math.abs(dx) + Math.abs(dy) < 3) return;
    if (!dragging) setDragging(true);
    setPos({
      x: clamp(d.origX + dx, 0, window.innerWidth - el.offsetWidth),
      y: clamp(d.origY + dy, 0, window.innerHeight - el.offsetHeight),
    });
  }

  function onDragEnd(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Capture мог уже сняться — игнорируем.
    }
  }

  function beginSeek(value: number) {
    draftRef.current = value;
    setDraft(value);
    setSeeking(true);
  }

  function updateSeek(value: number) {
    draftRef.current = value;
    setDraft(value);
  }

  function commitSeek() {
    const value = draftRef.current;
    draftRef.current = null;
    setDraft(null);
    setSeeking(false);
    if (value != null) player.seek(value);
  }

  if (!track) return null;

  const shown = draft ?? currentTime;
  const max = duration > 0 ? duration : 0;
  const progress = max > 0 ? Math.min((shown / max) * 100, 100) : 0;
  const repeatLabel =
    repeat === "one" ? "Повтор одного трека" : repeat === "all" ? "Повтор списка" : "Повтор выключен";

  return (
    <div
      ref={wrapRef}
      className="fixed z-40 w-[350px] max-w-[calc(100vw-1.5rem)]"
      style={pos ? { left: pos.x, top: pos.y } : { left: "0.75rem", bottom: "0.75rem" }}
    >
      <div className="mc-panel overflow-hidden">
        <div
          className={`mc-head touch-none select-none ${
            dragging ? "cursor-grabbing" : "cursor-grab"
          }`}
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          title="Перетащить плеер"
        >
          <GripIcon />
          <MusicIcon className="w-3.5 h-3.5 text-[var(--mc-green-light)]" />
          <span className="flex-1 truncate text-[10px]">Мини-плеер</span>
          <span className="shrink-0 text-[10px] font-normal normal-case tracking-normal text-[var(--text-muted)]">
            {player.index + 1}/{player.queue.length}
          </span>
          <button
            type="button"
            onClick={player.close}
            className="mc-btn h-6 w-6 p-0"
            title="Закрыть плеер"
            aria-label="Закрыть плеер"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="p-2.5">
          <div className="flex items-center gap-2.5">
            <span className="w-11 h-11 shrink-0 overflow-hidden border-2 border-black bg-[var(--card-alt)] flex items-center justify-center text-[var(--mc-green-light)]">
              {track.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={track.coverUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <MusicIcon className="w-5 h-5" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-bold" title={track.title}>
                {track.title}
              </div>
              <div className="truncate text-[10px] text-[var(--text-muted)]">
                {track.artist || "Без исполнителя"}
              </div>
            </div>
          </div>

          <input
            type="range"
            min={0}
            max={max || 0}
            step={0.1}
            value={max > 0 ? Math.min(shown, max) : 0}
            disabled={max <= 0}
            onPointerDown={() => beginSeek(currentTime)}
            onPointerUp={commitSeek}
            onChange={(e) => updateSeek(Number(e.target.value))}
            onKeyUp={(e) => {
              if (["ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"].includes(e.key)) {
                commitSeek();
              }
            }}
            onBlur={() => {
              if (draft != null) commitSeek();
            }}
            className="mc-range mt-2"
            style={{
              background: `linear-gradient(to right, var(--mc-green) ${progress}%, var(--input) ${progress}%)`,
            }}
            aria-label="Позиция воспроизведения"
            aria-valuetext={`${formatTime(shown)} из ${max > 0 ? formatTime(max) : "неизвестно"}`}
          />

          <div className="mt-0.5 flex items-center justify-between text-[10px] text-[var(--text-muted)]">
            <span>{formatTime(shown)}</span>
            <span>{max > 0 ? formatTime(max) : "--:--"}</span>
          </div>

          <div className="mt-2 flex items-center justify-center gap-1.5">
            <button
              type="button"
              onClick={player.toggleShuffle}
              className={`mc-btn h-8 w-8 p-0 ${shuffle ? "mc-btn-primary" : "text-[var(--text-secondary)]"}`}
              title={shuffle ? "Перемешивание включено" : "Перемешать"}
              aria-label={shuffle ? "Выключить перемешивание" : "Перемешать"}
              aria-pressed={shuffle}
            >
              <ShuffleIcon />
            </button>

            <button
              type="button"
              onClick={player.prev}
              className="mc-btn h-8 w-8 p-0"
              title="Предыдущий трек"
              aria-label="Предыдущий трек"
            >
              <PrevIcon />
            </button>

            <button
              type="button"
              onClick={player.toggle}
              className="mc-btn mc-btn-primary h-9 w-9 p-0"
              title={playing ? "Пауза" : "Слушать"}
              aria-label={playing ? "Пауза" : "Слушать"}
            >
              {playing ? <PauseIcon /> : <PlayIcon />}
            </button>

            <button
              type="button"
              onClick={player.next}
              className="mc-btn h-8 w-8 p-0"
              title="Следующий трек"
              aria-label="Следующий трек"
            >
              <NextIcon />
            </button>

            <button
              type="button"
              onClick={player.cycleRepeat}
              className={`mc-btn relative h-8 min-w-[44px] gap-1 px-1 ${
                repeat !== "off" ? "mc-btn-primary" : "text-[var(--text-secondary)]"
              }`}
              title={repeatLabel}
              aria-label={repeatLabel}
            >
              <RepeatIcon />
              {repeat !== "off" && (
                <span className="text-[9px] leading-none">{repeat === "one" ? "1" : "ВСЁ"}</span>
              )}
            </button>
          </div>

          {error && (
            <div className="mt-1.5 text-[10px] text-[var(--mc-red)]" role="alert">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
