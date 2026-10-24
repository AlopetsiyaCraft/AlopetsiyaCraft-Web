"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONS: Record<string, string> = {
  "": "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  "/wall": "M4 5h16v10H8l-4 4z",
  "/music": "M9 18V5l10-2v12M9 18a3 3 0 11-3-3M19 15a3 3 0 11-3-3",
  "/foto": "M4 5h16v14H4zM4 15l4-4 3 3 4-5 5 6M9 9h.01",
  "/friends": "M16 20v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 10a4 4 0 100-8 4 4 0 000 8zM22 20v-2a4 4 0 00-3-3.87M16 2.13a4 4 0 010 7.75",
};

const TABS = [
  { name: "Обзор", suffix: "" },
  { name: "Стена", suffix: "/wall" },
  { name: "Аудио", suffix: "/music" },
  { name: "Фото", suffix: "/foto" },
  { name: "Друзья", suffix: "/friends" },
];

/** Навигация по вкладкам профиля — пиксельные табы с иконками. */
export default function ProfileTabs({ baseHref }: { baseHref: string }) {
  const pathname = usePathname();
  return (
    <nav className="mc-panel-flat no-scrollbar flex gap-1 overflow-x-auto p-1.5">
      {TABS.map((tab) => {
        const href = baseHref + tab.suffix;
        const active = pathname === href;
        return (
          <Link
            key={tab.suffix || "/"}
            href={href}
            aria-current={active ? "page" : undefined}
            title={tab.name}
            className={`flex shrink-0 flex-1 items-center justify-center gap-1.5 border-2 px-3 py-1.5 text-[0.72rem] font-bold uppercase tracking-[0.08em] transition-colors sm:flex-none sm:justify-start ${
              active
                ? "border-black bg-[var(--mc-green)] text-[#0f1a08]"
                : "border-transparent text-[var(--text-muted)] hover:border-black hover:bg-[var(--hover)] hover:text-[var(--text)]"
            }`}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path strokeLinecap="square" strokeLinejoin="miter" d={ICONS[tab.suffix] ?? ""} />
            </svg>
            <span className="hidden sm:inline">{tab.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
