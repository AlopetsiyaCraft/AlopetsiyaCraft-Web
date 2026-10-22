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
    <nav className="mc-panel-flat no-scrollbar mb-6 flex gap-1 overflow-x-auto p-1.5">
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 border-2 px-4 py-1.5 text-[0.72rem] font-bold uppercase tracking-[0.08em] transition-colors ${
              active
                ? "border-black bg-[var(--mc-green)] text-[#0f1a08]"
                : "border-transparent text-[var(--text-muted)] hover:border-black hover:bg-[var(--hover)] hover:text-[var(--text)]"
            }`}
          >
            {tab.name}
          </Link>
        );
      })}
    </nav>
  );
}