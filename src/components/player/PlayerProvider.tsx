"use client";

import { useEffect, useRef, useState } from "react";
import MiniPlayer from "./MiniPlayer";
import {
  PlayerContext,
  type PlayerApi,
  type PlayerTrack,
} from "./PlayerContext";

const STATE_KEY = "mc-player-state-v1";
const VOLUME_KEY = "mc-player-volume-v1";

function readSavedVolume(): number {
  try {
    const raw = localStorage.getItem(VOLUME_KEY);
    if (raw == null) return 1;
    const value = Number(raw);
    if (!Number.isFinite(value)) return 1;
    return Math.min(Math.max(value, 0), 1);
  } catch {
    return 1;
  }
}

/** Состояние плеера, которое переживает перезагрузку страницы. */
interface SavedState {
  queue: PlayerTrack[];
  index: number;
  currentTime: number;
  repeat: boolean;
  shuffle: boolean;
  /** Порядок треков для перемешивания (индексы в queue). */
  shuffleOrder: number[];
}

/** Перемешанный порядок треков: текущий трек идёт первым, остальные — случайно. */
function makeShuffleOrder(length: number, first: number): number[] {
  if (length <= 0) return [];
  const start = first >= 0 && first < length ? first : 0;
  const rest = Array.from({ length }, (_, i) => i).filter((i) => i !== start);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return [start, ...rest];
}

/** Случайный индекс, отличный от текущего (если треков больше одного). */
function randomOther(length: number, current: number): number {
  if (length <= 1) return 0;
  let n = Math.floor(Math.random() * (length - 1));
  if (n >= current) n += 1;
  return n;
}

/** Проверяем, что сохранённый порядок — корректная перестановка всех треков. */
function isValidOrder(order: unknown, length: number): order is number[] {
  return (
    Array.isArray(order) &&
    order.length === length &&
    order.every(
      (n, i) =>
        typeof n === "number" &&
        n >= 0 &&
        n < length &&
        order.indexOf(n) === i
    )
  );
}

function readSavedState(): SavedState | null {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      queue?: unknown;
      index?: unknown;
      currentTime?: unknown;
      repeat?: unknown;
      shuffle?: unknown;
      shuffleOrder?: unknown;
    };
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
    // Старые сохранения хранили repeat строкой ("off" | "all" | "one").
    const repeat = parsed.repeat === true || parsed.repeat === "one";
    const shuffle = parsed.shuffle === true;
    const savedOrder = isValidOrder(parsed.shuffleOrder, queue.length)
      ? parsed.shuffleOrder
      : makeShuffleOrder(queue.length, index);
    return {
      queue,
      index,
      currentTime,
      repeat,
      shuffle,
      shuffleOrder: shuffle ? savedOrder : [],
    };
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
  const [repeat, setRepeat] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [shuffleOrder, setShuffleOrder] = useState<number[]>([]);
  const [volume, setVolumeState] = useState(readSavedVolume);
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
    repeat: boolean;
    shuffle: boolean;
    shuffleOrder: number[];
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
    setShuffleOrder(saved.shuffleOrder);
    setDuration(0);
    setError(null);
    restoreSeekRef.current = saved.currentTime;

    const audio = audioRef.current;
    if (audio) {
      audio.src = saved.queue[saved.index].url;
      audio.load();
    }
  }, []);

  // Громкость применяется к аудио и запоминается между перезагрузками.
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.volume = volume;
    try {
      localStorage.setItem(VOLUME_KEY, String(volume));
    } catch {
      // localStorage может быть недоступен — не критично.
    }
  }, [volume]);

  // Свежий снимок состояния — для сохранения при закрытии/сворачивании вкладки.
  useEffect(() => {
    snapshotRef.current = queue.length
      ? { queue, index, currentTime, repeat, shuffle, shuffleOrder }
      : null;
  }, [queue, index, currentTime, repeat, shuffle, shuffleOrder]);

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
      prev.shuffle !== shuffle ||
      prev.shuffleOrder !== shuffleOrder;
    metaRef.current = { queue, index, repeat, shuffle, shuffleOrder };
    if (!metaChanged && now - lastSaveRef.current < 1000) return;
    lastSaveRef.current = now;
    writeSavedState({ queue, index, currentTime, repeat, shuffle, shuffleOrder });
  }, [queue, index, currentTime, repeat, shuffle, shuffleOrder]);

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

    const absoluteUrl = new URL(nextTrack.url, window.location.href).href;
    if (audio.src !== absoluteUrl) {
      // Сначала останавливаем прошлый трек, потом меняем источник, и не трогаем
      // currentTime: иначе браузер начинал играть и сразу перематывался на 0 —
      // отсюда был слышен короткий провал/«затухание» в начале.
      audio.pause();
      audio.src = nextTrack.url;
    } else if (audio.currentTime > 0) {
      audio.currentTime = 0;
    }
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
    const i = found >= 0 ? found : 0;
    if (shuffle) setShuffleOrder(makeShuffleOrder(tracks.length, i));
    startAt(tracks, i);
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

  /** Следующий по порядку: при перемешивании — по перемешанному списку. */
  function nextTrack() {
    if (!queue.length) return;
    if (shuffle) {
      const order =
        shuffleOrder.length === queue.length
          ? shuffleOrder
          : makeShuffleOrder(queue.length, index);
      const pos = order.indexOf(index);
      if (pos >= 0 && pos + 1 < order.length) {
        if (order !== shuffleOrder) setShuffleOrder(order);
        startAt(queue, order[pos + 1], true);
        return;
      }
      // Круг закончился — начинаем новый, но не с только что игравшего трека.
      const fresh = makeShuffleOrder(queue.length, randomOther(queue.length, index));
      setShuffleOrder(fresh);
      startAt(queue, fresh[0], true);
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
      const order =
        shuffleOrder.length === queue.length
          ? shuffleOrder
          : makeShuffleOrder(queue.length, index);
      const pos = order.indexOf(index);
      if (pos > 0) {
        if (order !== shuffleOrder) setShuffleOrder(order);
        startAt(queue, order[pos - 1], true);
        return;
      }
      startAt(queue, order[order.length - 1], true);
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

  function toggleRepeat() {
    setRepeat((prev) => !prev);
  }

  function setVolume(value: number) {
    if (!Number.isFinite(value)) return;
    setVolumeState(Math.min(Math.max(value, 0), 1));
  }

  function toggleShuffle() {
    if (!shuffle) {
      setShuffleOrder(makeShuffleOrder(queue.length, index));
      setShuffle(true);
    } else {
      setShuffle(false);
      setShuffleOrder([]);
    }
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
    setRepeat(false);
    setShuffle(false);
    setShuffleOrder([]);
    setError(null);
  }

  function handleEnded() {
    const audio = audioRef.current;
    if (!audio || !queue.length) return;

    if (repeat) {
      audio.currentTime = 0;
      audio.play().catch(() => setError("Не удалось включить трек"));
      return;
    }

    if (shuffle) {
      const order =
        shuffleOrder.length === queue.length
          ? shuffleOrder
          : makeShuffleOrder(queue.length, index);
      const pos = order.indexOf(index);
      if (pos >= 0 && pos + 1 < order.length) {
        if (order !== shuffleOrder) setShuffleOrder(order);
        startAt(queue, order[pos + 1], true);
        return;
      }
      // Весь перемешанный список отыгран — останавливаемся.
      audio.currentTime = 0;
      setPlaying(false);
      setCurrentTime(0);
      return;
    }

    const ni = index + 1;
    if (ni < queue.length) {
      startAt(queue, ni, true);
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
    volume,
    error,
    play,
    toggle,
    next: nextTrack,
    prev,
    seek,
    setVolume,
    toggleRepeat,
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
