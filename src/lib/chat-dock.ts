"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "chatPinned";

type Listener = () => void;

/** null — значение ещё не прочитано (ядро чтения localStorage инициализирует один раз). */
let pinned: boolean | null = null;
const listeners = new Set<Listener>();

function readPinned(): boolean {
  if (pinned === null) {
    pinned =
      typeof window === "undefined" ? true : localStorage.getItem(STORAGE_KEY) !== "0";
  }
  return pinned;
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setChatPinned(next: boolean) {
  pinned = next;
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  }
  listeners.forEach((listener) => listener());
}

interface ChatDockValue {
  /** true — чат закреплён на главной странице; false — в плавающем окне на всех страницах */
  pinned: boolean;
  setPinned: (pinned: boolean) => void;
}

/**
 * Глобальное состояние «закреплён ли чат». Значение хранится в localStorage и
 * переживает переходы между страницами (модульный стор живёт в клиентском бандле).
 *
 * getServerSnapshot всегда возвращает true (закреплён): сервер и первая клиентская
 * отрисовка (гидратация) совпадают — hydration-варнингов нет, а реальное значение
 * из localStorage подхватывается сразу после гидратации.
 */
export function useChatDock(): ChatDockValue {
  const current = useSyncExternalStore(subscribe, readPinned, () => true);
  return { pinned: current, setPinned: setChatPinned };
}