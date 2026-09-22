"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { name: "Стена", suffix: "" },
  { name: "Аудио", suffix: "/music" },
  { name: "Фото", suffix: "/foto" },
  { name: "Друзья", suffix: "/friends" },
];

/** Навигация по вкладкам профиля (VK-стиль). */
export default function ProfileTabs({ baseHref }: { baseHref: string }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 border-b border-[var(--border)]">
      {TABS.map((t) => {
        const href = baseHref + t.suffix;
        const active = pathname === href;
        return (
          <Link
            key={t.suffix || "/"}
            href={href}
            className={`px-4 py-2.5 text-sm transition-colors ${
              active
                ? "text-[var(--text)] border-b-2 border-[#7c3aed]"
                : "text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
          >
            {t.name}
          </Link>
        );
      })}
    </nav>
  );
}