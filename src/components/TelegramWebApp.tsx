"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Минимальная часть Telegram.WebApp, которой пользуемся.
 * Полное API: https://core.telegram.org/bots/webapps
 */
interface TelegramWebApp {
  initData: string;
  platform: string;
  colorScheme: "light" | "dark";
  viewportHeight: number;
  viewportStableHeight: number;
  ready(): void;
  expand(): void;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  onEvent(event: string, callback: () => void): void;
  offEvent(event: string, callback: () => void): void;
  safeAreaInset?: { top: number; bottom: number; left: number; right: number };
  contentSafeAreaInset?: { top: number; bottom: number; left: number; right: number };
  BackButton: {
    show(): void;
    hide(): void;
    onClick(callback: () => void): void;
    offClick(callback: () => void): void;
  };
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

const DEFAULT_BG = "#121212";

/**
 * Фундамент Telegram Mini App.
 *
 * Сайт остаётся обычным сайтом: если открыт не в Telegram, компонент
 * ничего не делает. Внутри Telegram — сообщаем, что приложение готово,
 * разворачиваем окно и переносим safe-area/viewport в CSS-переменные.
 */
export default function TelegramWebApp() {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let disposed = false;
    let cleanupSdk: (() => void) | undefined;
    let cleanupWaiter: (() => void) | undefined;

    function start(app: TelegramWebApp) {
      if (disposed) return;

      document.documentElement.dataset.telegram = "1";

      function applyInsets() {
        const safe = app.contentSafeAreaInset ?? app.safeAreaInset;
        const root = document.documentElement;
        root.style.setProperty("--tg-safe-top", `${safe?.top ?? 0}px`);
        root.style.setProperty("--tg-safe-bottom", `${safe?.bottom ?? 0}px`);
        root.style.setProperty("--tg-safe-left", `${safe?.left ?? 0}px`);
        root.style.setProperty("--tg-safe-right", `${safe?.right ?? 0}px`);
        root.style.setProperty(
          "--tg-viewport-height",
          `${app.viewportStableHeight || app.viewportHeight}px`
        );
      }

      app.ready();
      app.expand();
      app.setHeaderColor?.(DEFAULT_BG);
      app.setBackgroundColor?.(DEFAULT_BG);
      applyInsets();

      app.onEvent("viewportChanged", applyInsets);
      app.onEvent("safeAreaChanged", applyInsets);
      app.onEvent("contentSafeAreaChanged", applyInsets);
      setReady(true);

      cleanupSdk = () => {
        app.offEvent("viewportChanged", applyInsets);
        app.offEvent("safeAreaChanged", applyInsets);
        app.offEvent("contentSafeAreaChanged", applyInsets);
        delete document.documentElement.dataset.telegram;
      };
    }

    function tryStart(): boolean {
      const app = window.Telegram?.WebApp;
      if (!app || app.platform === "unknown") return false;
      start(app);
      return true;
    }

    if (tryStart()) {
      // SDK уже загрузился (обычный случай в Telegram).
    } else {
      // SDK грузится асинхронно: ждём его появления. Вне Telegram он
      // не появится — через 15 секунд просто перестаём ждать.
      let attempts = 0;
      const onLoad = () => {
        if (tryStart()) cleanupWaiter?.();
      };
      const script = [...document.querySelectorAll<HTMLScriptElement>("script[src]")].find((item) =>
        item.src.includes("telegram-web-app")
      );
      script?.addEventListener("load", onLoad);
      window.addEventListener("load", onLoad);
      const timer = window.setInterval(() => {
        attempts += 1;
        onLoad();
        if (attempts >= 60) cleanupWaiter?.();
      }, 250);

      cleanupWaiter = () => {
        script?.removeEventListener("load", onLoad);
        window.removeEventListener("load", onLoad);
        window.clearInterval(timer);
      };
    }

    return () => {
      disposed = true;
      cleanupWaiter?.();
      cleanupSdk?.();
    };
  }, []);

  // Кнопка «назад» Telegram: показываем везде, кроме главной.
  useEffect(() => {
    if (!ready) return;
    const app = window.Telegram?.WebApp;
    if (!app) return;

    if (pathname === "/") {
      app.BackButton.hide();
      return;
    }

    const onBack = () => router.back();
    app.BackButton.onClick(onBack);
    app.BackButton.show();

    return () => {
      app.BackButton.offClick(onBack);
      app.BackButton.hide();
    };
  }, [ready, pathname, router]);

  return null;
}
