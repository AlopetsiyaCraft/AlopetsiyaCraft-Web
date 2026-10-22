import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Providers from "@/components/Providers";
import "./globals.css";

/**
 * Monocraft — пиксельный моноширинный шрифт в духе Minecraft.
 * Содержит полную кириллицу (в отличие от VT323) и настоящие веса,
 * поэтому используется и для интерфейса, и для цифр/IP.
 */
const monocraft = localFont({
  src: [
    { path: "./fonts/Monocraft-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/Monocraft-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "./fonts/Monocraft-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-pixel",
  display: "swap",
  fallback: ["Courier New", "monospace"],
});

export const metadata: Metadata = {
  title: {
    default: "АлопецияКрафт — Minecraft-сервер",
    template: "%s · АлопецияКрафт",
  },
  description:
    "Официальный сайт Minecraft-сервера АлопецияКрафт: карта мира, статистика, галерея, достижения и чат.",
};

export const viewport: Viewport = {
  themeColor: "#121212",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      className={`${monocraft.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        {/* Синхронный скрипт темы намеренный: класс ставится до отрисовки (анти-FOUC). Вынесен в файл, т.к. инлайн-скрипты в дереве React дают warning в консоли. */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/theme-init.js" />
      </head>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
