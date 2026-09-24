"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Tab {
  name: string;
  href: string;
}

/**
 * Вкладки сезона (Карта / Фото / Чат / Сборка).
 * Активная вкладка подсвечивается: жирный текст + цветная нижняя полоска.
 */
export default function SeasonTabs({ tabs }: { tabs: Tab[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 border-b border-[var(--border)] mb-8">
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={
              "px-6 py-3 transition-colors " +
              (active
                ? "text-[var(--text)] font-semibold border-b-2 border-[#7c3aed]"
                : "text-[var(--text-muted)] hover:text-[var(--text)] hover:border-b-2 hover:border-[#7c3aed]")
            }
          >
            {tab.name}
          </Link>
        );
      })}
    </nav>
  );
}