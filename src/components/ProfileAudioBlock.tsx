"use client";

import Link from "next/link";
import { usePlayer, type PlayerTrack } from "@/components/player/PlayerContext";
import type { AudioPreviewItem } from "@/lib/wallPreview";

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

/**
 * Блок «Аудио» на стене профиля.
 *
 * Клик по треку запускает его в общем мини-плеере сайта (без перехода на
 * /music); ссылка «Все» в шапке блока ведёт на полную страницу аудио.
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
  const player = usePlayer();

  const queue: PlayerTrack[] = tracks.map((t) => ({
    id: t.id,
    title: t.title,
    artist: t.artist,
    coverUrl: t.coverThumbUrl ?? t.coverUrl,
    url: t.url,
  }));

  function onTrackClick(track: AudioPreviewItem) {
    if (player.track?.id === track.id) {
      player.toggle();
      return;
    }
    player.play(queue, track.id);
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
          const isActive = player.track?.id === t.id;
          const isPlaying = isActive && player.playing;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onTrackClick(t)}
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
                  {t.artist || (isActive ? (isPlaying ? "Играет…" : "Пауза") : "Без исполнителя")}
                </span>
              </span>

              {isActive && (
                <span className="shrink-0 text-[10px] uppercase tracking-wider text-[var(--mc-green-light)]">
                  {isPlaying ? "LIVE" : "Пауза"}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
