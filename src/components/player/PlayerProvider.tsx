"use client";

import { useRef, useState } from "react";
import MiniPlayer from "./MiniPlayer";
import {
  PlayerContext,
  type PlayerApi,
  type PlayerTrack,
  type RepeatMode,
} from "./PlayerContext";

/** Случайный индекс, отличный от текущего (если треков больше одного). */
function randomOther(length: number, current: number): number {
  if (length <= 1) return 0;
  let n = Math.floor(Math.random() * (length - 1));
  if (n >= current) n += 1;
  return n;
}

/**
 * Общий плеер сайта.
 *
 * Живёт в корневом layout, поэтому музыка продолжает играть при переходах
 * между страницами; мини-плеер при этом остаётся на месте.
 */
export default function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<PlayerTrack[]>([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [repeat, setRepeat] = useState<RepeatMode>("off");
  const [shuffle, setShuffle] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const track = queue[index] ?? null;

  /** Загрузить и (опционально) запустить трек по индексу. */
  function startAt(list: PlayerTrack[], i: number, autoplay = true) {
    const audio = audioRef.current;
    const nextTrack = list[i];
    if (!audio || !nextTrack) return;

    setQueue(list);
    setIndex(i);
    setError(null);
    setCurrentTime(0);
    setDuration(0);

    if (audio.src !== nextTrack.url) {
      audio.src = nextTrack.url;
      audio.load();
    }
    audio.currentTime = 0;
    if (autoplay) {
      audio.play().catch(() => {
        setPlaying(false);
        setError("Не удалось включить трек");
      });
    }
  }

  function play(tracks: PlayerTrack[], startId?: number) {
    if (!tracks.length) return;
    const found = startId == null ? 0 : tracks.findIndex((t) => t.id === startId);
    startAt(tracks, found >= 0 ? found : 0);
  }

  function toggle() {
    const audio = audioRef.current;
    if (!audio || !track) return;
    setError(null);
    if (audio.paused) {
      audio.play().catch(() => setError("Не удалось включить трек"));
    } else {
      audio.pause();
    }
  }

  function nextTrack() {
    if (!queue.length) return;
    if (shuffle) {
      startAt(queue, randomOther(queue.length, index), true);
      return;
    }
    startAt(queue, (index + 1) % queue.length, true);
  }

  function prev() {
    const audio = audioRef.current;
    if (!audio || !queue.length) return;
    // Как в плеерах: «назад» в начале трека переключает, дальше — в начало.
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      setCurrentTime(0);
      return;
    }
    if (shuffle) {
      startAt(queue, randomOther(queue.length, index), true);
      return;
    }
    startAt(queue, (index - 1 + queue.length) % queue.length, true);
  }

  function seek(seconds: number) {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(seconds)) return;
    const max = Number.isFinite(audio.duration) ? audio.duration : seconds;
    const value = Math.min(Math.max(seconds, 0), Math.max(max, 0));
    audio.currentTime = value;
    setCurrentTime(value);
  }

  function cycleRepeat() {
    setRepeat((prev) => (prev === "off" ? "all" : prev === "all" ? "one" : "off"));
  }

  function toggleShuffle() {
    setShuffle((prev) => !prev);
  }

  function close() {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setQueue([]);
    setIndex(0);
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setError(null);
  }

  function handleEnded() {
    const audio = audioRef.current;
    if (!audio || !queue.length) return;

    if (repeat === "one") {
      audio.currentTime = 0;
      audio.play().catch(() => setError("Не удалось включить трек"));
      return;
    }

    if (shuffle) {
      startAt(queue, randomOther(queue.length, index), true);
      return;
    }

    const ni = index + 1;
    if (ni < queue.length) {
      startAt(queue, ni, true);
    } else if (repeat === "all") {
      startAt(queue, 0, true);
    } else {
      audio.currentTime = 0;
      setPlaying(false);
      setCurrentTime(0);
    }
  }

  const value: PlayerApi = {
    queue,
    index,
    track,
    playing,
    currentTime,
    duration,
    repeat,
    shuffle,
    error,
    play,
    toggle,
    next: nextTrack,
    prev,
    seek,
    cycleRepeat,
    toggleShuffle,
    close,
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
      <MiniPlayer />
      <audio
        ref={audioRef}
        preload="metadata"
        className="hidden"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          setDuration(Number.isFinite(d) ? d : 0);
        }}
        onDurationChange={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d)) setDuration(d);
        }}
        onEnded={handleEnded}
        onError={(e) => {
          if (!e.currentTarget.src) return;
          setPlaying(false);
          setError("Не удалось воспроизвести трек");
        }}
      />
    </PlayerContext.Provider>
  );
}
