"use client";

import { useEffect, useRef, useState } from "react";
import MiniPlayer from "./MiniPlayer";
import {
  PlayerContext,
  type PlayerApi,
  type PlayerTrack,
  type RepeatMode,
} from "./PlayerContext";

const STATE_KEY = "mc-player-state-v1";

/** Состояние плеера, которое переживает перезагрузку страницы. */
interface SavedState {
  queue: PlayerTrack[];
  index: number;
  currentTime: number;
  repeat: RepeatMode;
  shuffle: boolean;
}

function readSavedState(): SavedState | null {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedState>;
    if (!Array.isArray(parsed.queue) || !parsed.queue.length) return null;
    const queue = parsed.queue.filter(
      (t): t is PlayerTrack =>
        !!t &&
        typeof t.id === "number" &&
        typeof t.title === "string" &&
        typeof t.url === "string"
    );
    if (!queue.length) return null;
    const index =
      typeof parsed.index === "number" && parsed.index >= 0 && parsed.index < queue.length
        ? parsed.index
        : 0;
    const currentTime =
      typeof parsed.currentTime === "number" && Number.isFinite(parsed.currentTime) && parsed.currentTime > 0
        ? parsed.currentTime
        : 0;
    const repeat: RepeatMode =
      parsed.repeat === "all" || parsed.repeat === "one" ? parsed.repeat : "off";
    return { queue, index, currentTime, repeat, shuffle: parsed.shuffle === true };
  } catch {
    return null;
  }
}

function writeSavedState(state: SavedState): void {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    // localStorage может быть недоступен (приватный режим) — не критично.
  }
}

function clearSavedState(): void {
  try {
    localStorage.removeItem(STATE_KEY);
  } catch {
    // ignore
  }
}

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
 *
 * После перезагрузки страницы (F5) трек, очередь и позиция восстанавливаются,
 * но плеер остаётся на паузе — браузер не разрешает автозапуск звука.
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

  /** Позиция, которую нужно применить после загрузки метаданных восстановленного трека. */
  const restoreSeekRef = useRef<number | null>(null);
  const restoredRef = useRef(false);
  const lastSaveRef = useRef(0);
  const snapshotRef = useRef<SavedState | null>(null);
  const metaRef = useRef<{
    queue: PlayerTrack[];
    index: number;
    repeat: RepeatMode;
    shuffle: boolean;
  } | null>(null);

  const track = queue[index] ?? null;

  // Восстанавливаем трек и позицию после перезагрузки (всегда на паузе).
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    const saved = readSavedState();
    if (!saved) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- состояние читается из localStorage один раз после гидратации
    setQueue(saved.queue);
    setIndex(saved.index);
    setCurrentTime(saved.currentTime);
    setRepeat(saved.repeat);
    setShuffle(saved.shuffle);
    setDuration(0);
    setError(null);
    restoreSeekRef.current = saved.currentTime;

    const audio = audioRef.current;
    if (audio) {
      audio.src = saved.queue[saved.index].url;
      audio.load();
    }
  }, []);

  // Свежий снимок состояния — для сохранения при закрытии/сворачивании вкладки.
  useEffect(() => {
    snapshotRef.current = queue.length
      ? { queue, index, currentTime, repeat, shuffle }
      : null;
  }, [queue, index, currentTime, repeat, shuffle]);

  // Сохраняем состояние: смену трека/режимов — сразу, позицию — не чаще раза в секунду.
  useEffect(() => {
    if (!queue.length) {
      metaRef.current = null;
      return;
    }
    const now = Date.now();
    const prev = metaRef.current;
    const metaChanged =
      !prev ||
      prev.queue !== queue ||
      prev.index !== index ||
      prev.repeat !== repeat ||
      prev.shuffle !== shuffle;
    metaRef.current = { queue, index, repeat, shuffle };
    if (!metaChanged && now - lastSaveRef.current < 1000) return;
    lastSaveRef.current = now;
    writeSavedState({ queue, index, currentTime, repeat, shuffle });
  }, [queue, index, currentTime, repeat, shuffle]);

  // Перед уходом со страницы (F5, закрытие, скрытие вкладки) фиксируем точную секунду.
  useEffect(() => {
    function flush() {
      if (snapshotRef.current) writeSavedState(snapshotRef.current);
    }
    function onVisibility() {
      if (document.visibilityState === "hidden") flush();
    }
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  /** Загрузить и (опционально) запустить трек по индексу. */
  function startAt(list: PlayerTrack[], i: number, autoplay = true) {
    const audio = audioRef.current;
    const nextTrack = list[i];
    if (!audio || !nextTrack) return;

    restoreSeekRef.current = null;
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
    clearSavedState();
    lastSaveRef.current = 0;
    snapshotRef.current = null;
    metaRef.current = null;
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
          const el = e.currentTarget;
          const d = el.duration;
          setDuration(Number.isFinite(d) ? d : 0);

          const pending = restoreSeekRef.current;
          if (pending != null) {
            restoreSeekRef.current = null;
            const seconds = Math.min(
              Math.max(pending, 0),
              Number.isFinite(d) ? d : pending
            );
            try {
              el.currentTime = seconds;
            } catch {
              // некоторые браузеры не дают ставить позицию до полной загрузки
            }
            setCurrentTime(seconds);
          }
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
