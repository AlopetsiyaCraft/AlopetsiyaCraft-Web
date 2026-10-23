"use client";

import { useRouter } from "next/navigation";

/**
 * Выбор категории статистики на телефоне.
 * На десктопе вместо него показываются обычные табы (они помещаются в строку).
 */
export default function StatsCategoryPicker({
  categories,
  value,
  a,
  b,
}: {
  categories: Array<{ key: string; label: string }>;
  value: string;
  a?: string;
  b?: string;
}) {
  const router = useRouter();

  return (
    <label className="mc-panel-flat flex items-center gap-2 px-2 py-1.5 sm:hidden">
      <span className="shrink-0 text-[0.58rem] uppercase tracking-[0.12em] text-[var(--text-muted)]">
        Категория
      </span>
      <select
        value={value}
        onChange={(event) => {
          const query = new URLSearchParams();
          query.set("sort", event.target.value);
          if (a) query.set("a", a);
          if (b) query.set("b", b);
          router.push(`/stats?${query.toString()}`);
        }}
        className="mc-input min-w-0 flex-1 py-1 text-xs"
        aria-label="Категория статистики"
      >
        {categories.map((category) => (
          <option key={category.key} value={category.key}>
            {category.label}
          </option>
        ))}
      </select>
    </label>
  );
}
