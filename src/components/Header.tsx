"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";

interface Season {
  number: number;
  name: string;
  isActive: boolean;
}

interface User {
  name: string;
  skinUrl?: string | null;
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
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const seasonsRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("theme") as "dark" | "light" | null;
    if (saved) {
      setTheme(saved);
      document.documentElement.classList.toggle("light", saved === "light");
    }
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
    <header className="header border-b border-[var(--border)] bg-[var(--bg)] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-[#7c3aed]">
          АлопецияКрафт
        </Link>

        <nav className="flex items-center gap-4">
          <Link
            href="/stats"
            className="text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors px-3 py-2 rounded-lg"
          >
            Статистика
          </Link>

          <Link
            href="/gallery"
            className="text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors px-3 py-2 rounded-lg"
          >
            Галерея
          </Link>

          <div ref={seasonsRef} className="relative">
            <button
              onClick={() => { setSeasonsOpen(!seasonsOpen); setUserOpen(false); }}
              className="text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer"
            >
              Сезоны
              <svg className={`w-4 h-4 transition-transform ${seasonsOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {seasonsOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-xl overflow-hidden">
                {seasons.length === 0 ? (
                  <div className="p-4 text-[var(--text-muted)] text-sm">Сезоны скоро</div>
                ) : (
                  seasons.map((season) => (
                    <Link
                      key={season.number}
                      href={`/seasons/${season.number}`}
                      onClick={() => setSeasonsOpen(false)}
                      className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors ${season.isActive ? "bg-[#7c3aed]/10" : ""}`}
                    >
                      <span className={season.isActive ? "text-[var(--text)]" : "text-[var(--text-muted)]"}>
                        Сезон {season.number}
                      </span>
                      {season.isActive && (
                        <span className="text-xs px-2 py-0.5 bg-green-900 text-green-300 rounded-full">Активный</span>
                      )}
                    </Link>
                  ))
                )}
              </div>
            )}
          </div>

          {isLoggedIn ? (
            <>
              <div ref={userRef} className="relative">
                <button
                  onClick={() => { setUserOpen(!userOpen); setSeasonsOpen(false); }}
                  className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors px-2 py-1 rounded-lg cursor-pointer"
                >
                  {user?.skinUrl ? (
                    <div className="w-8 h-8 rounded relative">
                      <div
                        className="absolute inset-0"
                        style={{
                          backgroundImage: `url(${user.skinUrl})`,
                          backgroundSize: "256px 256px",
                          backgroundPosition: "-32px -32px",
                          imageRendering: "pixelated",
                        }}
                      />
                      <div
                        className="absolute inset-0"
                        style={{
                          backgroundImage: `url(${user.skinUrl})`,
                          backgroundSize: "256px 256px",
                          backgroundPosition: "-160px -32px",
                          imageRendering: "pixelated",
                        }}
                      />
                    </div>
                  ) : (
                    <div className="w-8 h-8 bg-[#7c3aed] rounded flex items-center justify-center text-sm font-bold">
                      {user?.name?.[0]?.toUpperCase() || "?"}
                    </div>
                  )}
                  <span className="hidden sm:inline">{user?.name}</span>
                  <svg className={`w-4 h-4 transition-transform ${userOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {userOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-xl overflow-hidden">
                    <Link
                      href="/profile"
                      onClick={() => setUserOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer text-[var(--text)]"
                    >
                      <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Мой аккаунт
                    </Link>
                    <Link
                      href={user?.name ? `/profile/${encodeURIComponent(user.name)}/appearance` : "/profile"}
                      onClick={() => setUserOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer text-[var(--text)]"
                    >
                      <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                      </svg>
                      Внешний вид
                    </Link>
                    <Link
                      href="/music"
                      onClick={() => setUserOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer text-[var(--text)]"
                    >
                      <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 8.5L21 6" />
                      </svg>
                      Мои аудио
                    </Link>
                    <Link
                      href={user?.name ? `/profile/${encodeURIComponent(user.name)}/friends` : "/profile"}
                      onClick={() => setUserOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer text-[var(--text)]"
                    >
                      <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Друзья
                    </Link>
                    <Link
                      href="/inventory"
                      onClick={() => setUserOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer text-[var(--text)]"
                    >
                      <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                      Инвентарь
                    </Link>

                    <div className="border-t border-[var(--border)]" />

                    <Link
                      href="/profile/settings"
                      onClick={() => setUserOpen(false)}
                      className="w-full flex items-center gap-3 px-4 py-3 cursor-pointer text-[var(--text)]"
                    >
                      <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Настройка учётной записи
                    </Link>
                    <button
                      onClick={() => { setUserOpen(false); signOut({ callbackUrl: "/" }); }}
                      className="w-full flex items-center gap-3 px-4 py-3 cursor-pointer text-red-400"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Выйти
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={toggleTheme}
                className="w-10 h-10 flex items-center justify-center rounded-lg cursor-pointer transition-colors"
                title={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
              >
                {theme === "dark" ? (
                  <svg className="w-5 h-5" fill="none" stroke="#fbbf24" strokeWidth="2" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="#fbbf24" stroke="#fbbf24" strokeWidth="1" viewBox="0 0 24 24">
                    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                  </svg>
                )}
              </button>
            </>
          ) : (
            <Link
              href="/auth/login"
              className="px-4 py-2 bg-[#7c3aed] hover:bg-[#6d28d9] rounded-lg text-white text-sm transition-colors"
            >
              Войти
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
