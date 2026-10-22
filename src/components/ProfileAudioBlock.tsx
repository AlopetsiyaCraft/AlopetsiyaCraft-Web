"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { AudioPreviewItem } from "@/lib/wallPreview";

/** «0:00» из секунд. */
function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function MusicIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
    </svg>
  );
}

function PlayIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M8 5.5v13l11-6.5-11-6.5z" />
    </svg>
  );
}

function PauseIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
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
 * Блок «Аудио» на стене профиля.
 *
 * Клик по треку запускает его сразу в мини-плеере (без перехода на /music);
 * ссылка «Все» в шапке блока ведёт на полную страницу аудио.
 */
export default function ProfileAudioBlock({
  tracks,
  total,
  baseHref,
}: {
  tracks: AudioPreviewItem[];
  total: number;
  baseHref: string;
}) {
  const [activeId, setActiveId] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const active = tracks.find((t) => t.id === activeId) ?? null;
  const progress = duration > 0 ? Math.min((current / duration) * 100, 100) : 0;

  // Останавливаем звук, если ушли со стены профиля.
  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      audio?.pause();
    };
  }, []);

  function toggle(track: AudioPreviewItem) {
    const audio = audioRef.current;
    if (!audio) return;
    setError(null);

    if (activeId === track.id && audio.src) {
      if (audio.paused) {
        audio.play().catch(() => setError("Не удалось включить трек"));
      } else {
        audio.pause();
      }
      return;
    }

    setActiveId(track.id);
    setCurrent(0);
    setDuration(0);
    audio.src = track.url;
    audio.currentTime = 0;
    audio.play().catch(() => {
      setPlaying(false);
      setError("Не удалось включить трек");
    });
  }

  function closePlayer() {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setActiveId(null);
    setPlaying(false);
    setCurrent(0);
    setDuration(0);
    setError(null);
  }

  return (
    <section className="mc-panel">
      <div className="mc-head">
        <h2 className="min-w-0 flex-1 text-sm font-semibold">
          Аудио
          <span className="text-[var(--text-muted)] font-normal ml-1.5">{total}</span>
        </h2>
        <Link
          href={`${baseHref}/music`}
          className="text-xs text-[var(--mc-green-light)] hover:text-[var(--mc-green)] shrink-0"
        >
          Все
        </Link>
      </div>

      <div className="flex flex-col p-3">
        {tracks.map((t) => {
          const isActive = activeId === t.id;
          const isPlaying = isActive && playing;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => toggle(t)}
              className={`group flex w-full items-center gap-3 px-1 py-2 text-left border-2 transition-colors ${
                isActive
                  ? "border-black bg-[var(--hover)]"
                  : "border-transparent hover:border-black hover:bg-[var(--hover)]"
              }`}
              title={isPlaying ? `Пауза — ${t.title}` : `Слушать — ${t.title}`}
              aria-label={isPlaying ? `Пауза: ${t.title}` : `Слушать: ${t.title}`}
            >
              <span className="relative w-11 h-11 shrink-0 overflow-hidden border-2 border-black bg-[var(--card-alt)] flex items-center justify-center text-[var(--mc-green-light)]">
                {t.coverThumbUrl || t.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={t.coverThumbUrl ?? (t.coverUrl as string)}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <MusicIcon />
                )}
                <span
                  className={`absolute inset-0 flex items-center justify-center bg-black/55 text-white transition-opacity ${
                    isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  }`}
                >
                  {isPlaying ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
                </span>
              </span>

              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium truncate">{t.title}</span>
                <span className="block text-xs text-[var(--text-muted)] truncate">
                  {t.artist || (isActive ? "Играет…" : "Без исполнителя")}
                </span>
              </span>

              {isActive && (
                <span className="shrink-0 text-[10px] uppercase tracking-wider text-[var(--mc-green-light)]">
                  {playing ? "LIVE" : "Пауза"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {active && (
        <div className="fixed bottom-3 left-3 z-40 w-[350px] max-w-[calc(100vw-1.5rem)]">
          <div className="mc-panel">
            <div className="flex items-center gap-2 border-b-2 border-black bg-[var(--card-alt)] px-2.5 py-1.5 shadow-[inset_0_2px_0_var(--pixel-hi)]">
              <MusicIcon className="w-3.5 h-3.5 text-[var(--mc-green-light)]" />
              <span className="flex-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                Мини-плеер
              </span>
              <button
                type="button"
                onClick={closePlayer}
                className="mc-btn h-6 w-6 p-0"
                title="Закрыть плеер"
                aria-label="Закрыть плеер"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="flex items-center gap-2.5 p-2.5">
              <span className="w-11 h-11 shrink-0 overflow-hidden border-2 border-black bg-[var(--card-alt)] flex items-center justify-center text-[var(--mc-green-light)]">
                {active.coverThumbUrl || active.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={active.coverThumbUrl ?? (active.coverUrl as string)}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <MusicIcon />
                )}
              </span>

              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-bold" title={active.title}>
                  {active.title}
                </div>
                <div className="truncate text-[10px] text-[var(--text-muted)]">
                  {active.artist || "Без исполнителя"}
                </div>

                <input
                  type="range"
                  min={0}
                  max={duration > 0 ? duration : 0}
                  step={0.1}
                  value={duration > 0 ? Math.min(current, duration) : 0}
                  onChange={(e) => {
                    const audio = audioRef.current;
                    if (!audio) return;
                    const value = Number(e.target.value);
                    audio.currentTime = value;
                    setCurrent(value);
                  }}
                  disabled={duration <= 0}
                  className="mc-range mt-1.5"
                  style={{
                    background: `linear-gradient(to right, var(--mc-green) ${progress}%, var(--input) ${progress}%)`,
                  }}
                  aria-label="Позиция воспроизведения"
                />

                <div className="mt-0.5 flex items-center justify-between text-[10px] text-[var(--text-muted)]">
                  <span>{formatTime(current)}</span>
                  <span>{duration > 0 ? formatTime(duration) : "--:--"}</span>
                </div>

                {error && (
                  <div className="mt-1 text-[10px] text-[var(--mc-red)]" role="alert">
                    {error}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => active && toggle(active)}
                className="mc-btn mc-btn-primary h-10 w-10 shrink-0 p-0"
                title={playing ? "Пауза" : "Слушать"}
                aria-label={playing ? "Пауза" : "Слушать"}
              >
                {playing ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      )}

      <audio
        ref={audioRef}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          setDuration(Number.isFinite(d) ? d : 0);
        }}
        onDurationChange={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d)) setDuration(d);
        }}
        onEnded={() => {
          setPlaying(false);
          setCurrent(0);
        }}
        onError={() => {
          if (!audioRef.current?.src) return;
          setPlaying(false);
          setError("Не удалось воспроизвести трек");
        }}
      />
    </section>
  );
}
