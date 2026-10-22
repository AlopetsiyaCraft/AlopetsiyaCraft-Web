"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { name: "Стена", suffix: "" },
  { name: "Аудио", suffix: "/music" },
  { name: "Фото", suffix: "/foto" },
  { name: "Друзья", suffix: "/friends" },
  { name: "Внешний вид", suffix: "/appearance" },
];

/** Навигация по вкладкам профиля — пиксельные табы. */
export default function ProfileTabs({ baseHref }: { baseHref: string }) {
  const pathname = usePathname();
  return (
    <nav className="mc-panel-flat no-scrollbar flex gap-1 overflow-x-auto p-1.5">
      {TABS.map((t) => {
        const href = baseHref + t.suffix;
        const active = pathname === href;
        return (
          <Link
            key={t.suffix || "/"}
            href={href}
            className={`shrink-0 border-2 px-3 py-1.5 text-[0.72rem] font-bold uppercase tracking-[0.08em] transition-colors ${
              active
                ? "border-black bg-[var(--mc-green)] text-[#0f1a08]"
                : "border-transparent text-[var(--text-muted)] hover:border-black hover:bg-[var(--hover)] hover:text-[var(--text)]"
            }`}
          >
            {t.name}
          </Link>
        );
      })}
    </nav>
  );
}
