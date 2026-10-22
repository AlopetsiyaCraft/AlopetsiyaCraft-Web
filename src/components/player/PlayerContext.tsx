"use client";

import { createContext, useContext } from "react";

/** Трек, который умеет играть общий плеер сайта. */
export interface PlayerTrack {
  id: number;
  title: string;
  artist: string | null;
  /** Обложка (миниатюра, если есть). */
  coverUrl: string | null;
  /** Прямая ссылка на mp3. */
  url: string;
}

export type RepeatMode = "off" | "all" | "one";

export interface PlayerApi {
  queue: PlayerTrack[];
  index: number;
  track: PlayerTrack | null;
  playing: boolean;
  currentTime: number;
  duration: number;
  repeat: RepeatMode;
  shuffle: boolean;
  error: string | null;
  /** Запустить трек из списка (список становится очередью). */
  play: (tracks: PlayerTrack[], startId?: number) => void;
  /** Пауза / продолжить текущий трек. */
  toggle: () => void;
  next: () => void;
  prev: () => void;
  /** Перемотка (секунды). */
  seek: (seconds: number) => void;
  cycleRepeat: () => void;
  toggleShuffle: () => void;
  /** Остановить и убрать плеер. */
  close: () => void;
}

export const PlayerContext = createContext<PlayerApi | null>(null);

/** Доступ к общему плееру (он живёт в корневом layout и не прерывается при переходах). */
export function usePlayer(): PlayerApi {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer должен использоваться внутри PlayerProvider");
  return ctx;
}
