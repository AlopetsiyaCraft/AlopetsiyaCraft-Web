"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import PlayerHead from "@/components/mc/PlayerHead";
import NotificationsBell from "@/components/NotificationsBell";

interface Season {
  number: number;
  name: string;
  isActive: boolean;
}

interface User {
  name: string;
  skinUrl?: string | null;
  /** Болды (BLD) — внутриигровая валюта. */
  bld?: number;
}

const NAV = [
  { href: "/stats", label: "Статистика" },
  { href: "/gallery", label: "Галерея" },
  { href: "/market", label: "Маркет" },
  { href: "/shop", label: "Магазин" },
];

const USER_LINKS = [
  { href: "/profile", label: "Мой аккаунт", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
  { href: "/inventory", label: "Инвентарь", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
  { href: "/wallet", label: "Кошелёк", icon: "M19 21V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16m15 0H3m16 0a2 2 0 002-2v-4a2 2 0 00-2-2h-3a2 2 0 00-2 2v2a2 2 0 002 2h3z" },
  { href: "/music", label: "Мои аудио", icon: "M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 8.5L21 6" },
];

/** Иконка блока травы — пиксельный «логотип» сервера. */
function GrassBlock({ size = 26 }: { size?: number }) {
  return (
    <span
      className="relative inline-block shrink-0 border-2 border-black"
      style={{
        width: size,
        height: size,
        background:
          "linear-gradient(to bottom, #7dbb52 0 32%, #5d9c3c 32% 45%, #8b7355 45% 100%)",
        boxShadow: "inset -2px -2px 0 rgba(0,0,0,.35), inset 2px 2px 0 rgba(255,255,255,.25)",
      }}
      aria-hidden
    />
  );
}

export default function Header({
  seasons,
  user,
  isLoggedIn,
}: {
  seasons: Season[];
  user?: User;
  isLoggedIn: boolean;
}) {
  const [seasonsOpen, setSeasonsOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const seasonsRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("theme") as "dark" | "light" | null;
    if (!saved) return;
    const id = window.setTimeout(() => {
      setTheme(saved);
      document.documentElement.classList.toggle("light", saved === "light");
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.classList.toggle("light", next === "light");
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (seasonsRef.current && !seasonsRef.current.contains(e.target as Node)) {
        setSeasonsOpen(false);
      }
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setUserOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <header className="mc-site-header sticky top-0 z-50">
      <div className="mc-grass-line" />
      <div className="border-b-2 border-black bg-[var(--bg-alt)]/95 backdrop-blur-[2px]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          {/* Логотип */}
          <Link href="/" className="group flex min-w-0 items-center gap-2.5" onClick={() => setMobileOpen(false)}>
            <GrassBlock />
            <span className="mc-text-shadow hidden truncate text-[1.05rem] font-bold uppercase leading-none tracking-[0.06em] min-[360px]:block sm:text-[1.2rem]">
              <span className="text-[var(--text)]">Алопеция</span>
              <span className="text-[var(--mc-green-light)]">Крафт</span>
            </span>
          </Link>

          {/* Навигация (десктоп) */}
          <nav className="hidden items-center gap-0.5 lg:flex">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="mc-nav-link">
                {item.label}
              </Link>
            ))}

            <div ref={seasonsRef} className="relative">
              <button
                onClick={() => {
                  setSeasonsOpen(!seasonsOpen);
                  setUserOpen(false);
                }}
                className="mc-nav-link flex cursor-pointer items-center gap-1.5"
                aria-expanded={seasonsOpen}
              >
                Сезоны
                <svg
                  className={`h-3 w-3 transition-transform ${seasonsOpen ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={3}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="square" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {seasonsOpen && (
                <div className="mc-panel absolute right-0 top-full mt-2 w-60 overflow-hidden">
                  <div className="mc-head text-[0.68rem]">Сезоны сервера</div>
                  {seasons.length === 0 ? (
                    <div className="p-4 text-sm text-[var(--text-muted)]">Сезоны скоро</div>
                  ) : (
                    seasons.map((season) => (
                      <Link
                        key={season.number}
                        href={`/seasons/${season.number}`}
                        onClick={() => setSeasonsOpen(false)}
                        className="flex items-center justify-between border-b-2 border-black/40 px-3 py-2.5 text-sm transition-colors last:border-b-0 hover:bg-[var(--hover)]"
                      >
                        <span className={season.isActive ? "text-[var(--text)]" : "text-[var(--text-secondary)]"}>
                          Сезон {season.number}
                          {season.name ? <span className="ml-1.5 text-xs text-[var(--text-muted)]">{season.name}</span> : null}
                        </span>
                        {season.isActive && (
                          <span className="mc-chip text-[0.62rem] text-[var(--mc-green-light)]">Активный</span>
                        )}
                      </Link>
                    ))
                  )}
                </div>
              )}
            </div>
          </nav>

          {/* Правая часть */}
          <div className="flex items-center gap-2">
            {isLoggedIn ? (
              <>
                <div ref={userRef} className="relative">
                  <button
                    onClick={() => {
                      setUserOpen(!userOpen);
                      setSeasonsOpen(false);
                    }}
                    className="mc-panel-flat flex cursor-pointer items-center gap-2 px-2 py-1.5 transition-colors hover:bg-[var(--hover)]"
                    aria-expanded={userOpen}
                  >
                    <PlayerHead skinUrl={user?.skinUrl} nickname={user?.name ?? "?"} size={28} border={false} />
                    <span className="hidden max-w-[9rem] truncate text-sm font-semibold sm:inline">
                      {user?.name}
                    </span>
                    <svg
                      className={`hidden h-3.5 w-3.5 transition-transform sm:block ${userOpen ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={3}
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="square" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {userOpen && (
                    <div className="mc-panel absolute right-0 top-full mt-2 w-60 overflow-hidden">
                      <div className="mc-head justify-between text-[0.68rem]">
                        <span>Аккаунт</span>
                        {user?.bld != null && (
                          <span className="font-mono text-[var(--mc-gold)]">
                            {user.bld.toLocaleString("ru-RU")} BLD
                          </span>
                        )}
                      </div>

                      {USER_LINKS.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => setUserOpen(false)}
                          className="flex items-center gap-3 border-b-2 border-black/40 px-3 py-2.5 text-sm text-[var(--text)] transition-colors hover:bg-[var(--hover)]"
                        >
                          <svg className="h-4 w-4 text-[var(--mc-green-light)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="square" strokeLinejoin="miter" d={link.icon} />
                          </svg>
                          {link.label}
                        </Link>
                      ))}

                      <Link
                        href={
                          user?.name
                            ? `/profile/${encodeURIComponent(user.name)}/friends`
                            : "/profile"
                        }
                        onClick={() => setUserOpen(false)}
                        className="flex items-center gap-3 border-b-2 border-black/40 px-3 py-2.5 text-sm transition-colors hover:bg-[var(--hover)]"
                      >
                        <svg className="h-4 w-4 text-[var(--mc-green-light)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="square" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7v-2c0-.656.126-1.283.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Друзья
                      </Link>

                      <Link
                        href="/profile/settings"
                        onClick={() => setUserOpen(false)}
                        className="flex items-center gap-3 border-b-2 border-black/40 px-3 py-2.5 text-sm transition-colors hover:bg-[var(--hover)]"
                      >
                        <svg className="h-4 w-4 text-[var(--mc-green-light)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="square" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="square" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Настройки
                      </Link>

                      <button
                        onClick={() => {
                          setUserOpen(false);
                          signOut({ callbackUrl: "/" });
                        }}
                        className="flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left text-sm text-[var(--mc-red)] transition-colors hover:bg-[var(--hover)]"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="square" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Выйти
                      </button>
                    </div>
                  )}
                </div>

                {user?.bld != null && (
                  <Link
                    href="/wallet"
                    title="Кошелёк: болды (BLD)"
                    className="mc-chip hidden font-mono text-[var(--mc-gold)] hover:bg-[var(--hover)] md:inline-flex"
                  >
                    <span className="text-[var(--text-muted)]">BLD</span>
                    {user.bld.toLocaleString("ru-RU")}
                  </Link>
                )}

                <NotificationsBell />
              </>
            ) : (
              <Link href="/auth/login" className="mc-btn mc-btn-primary hidden px-3 py-1.5 text-xs sm:inline-flex">
                Войти
              </Link>
            )}

            <button
              onClick={toggleTheme}
              className="mc-panel-flat hidden h-9 w-9 cursor-pointer items-center justify-center transition-colors hover:bg-[var(--hover)] sm:flex"
              title={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
              aria-label="Переключить тему"
            >
              {theme === "dark" ? (
                <svg className="h-4 w-4" fill="none" stroke="#f2c94c" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="4" />
                  <path strokeLinecap="square" d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="#f2c94c" stroke="#f2c94c" strokeWidth="1" viewBox="0 0 24 24">
                  <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                </svg>
              )}
            </button>

            {/* Бургер */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="mc-panel-flat flex h-9 w-9 cursor-pointer items-center justify-center lg:hidden"
              aria-label="Меню"
              aria-expanded={mobileOpen}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                {mobileOpen ? (
                  <path strokeLinecap="square" d="M6 6l12 12M18 6L6 18" />
                ) : (
                  <path strokeLinecap="square" d="M4 7h16M4 12h16M4 17h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Мобильное меню */}
        {mobileOpen && (
          <div className="border-t-2 border-black bg-[var(--bg-alt)] lg:hidden">
            <nav className="mx-auto grid max-w-7xl grid-cols-2 gap-px bg-black/40 p-px">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="bg-[var(--card)] px-4 py-3 text-sm font-semibold uppercase tracking-wider transition-colors hover:bg-[var(--hover)]"
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="/seasons"
                onClick={() => setMobileOpen(false)}
                className="bg-[var(--card)] px-4 py-3 text-sm font-semibold uppercase tracking-wider transition-colors hover:bg-[var(--hover)]"
              >
                Сезоны
              </Link>
              {!isLoggedIn && (
                <Link
                  href="/auth/login"
                  onClick={() => setMobileOpen(false)}
                  className="bg-[var(--mc-green-dark)] px-4 py-3 text-sm font-semibold uppercase tracking-wider text-white"
                >
                  Войти
                </Link>
              )}
              <button
                type="button"
                onClick={() => {
                  toggleTheme();
                  setMobileOpen(false);
                }}
                className="col-span-2 cursor-pointer bg-[var(--card)] px-4 py-3 text-left text-sm font-semibold uppercase tracking-wider transition-colors hover:bg-[var(--hover)]"
              >
                {theme === "dark" ? "Светлая тема" : "Тёмная тема"}
              </button>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
