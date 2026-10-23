"use client";

import { useState } from "react";
import {
  DEFAULT_PROFILE_LAYOUT,
  PROFILE_BLOCKS,
  type ProfileBlock,
  type ProfileBlockId,
} from "@/lib/profileLayout";

const LABELS = new Map(PROFILE_BLOCKS.map((block) => [block.id, block]));
const HINTS = new Map(PROFILE_BLOCKS.map((block) => [block.id, block.hint]));

export default function ProfileLayoutForm({
  initialLayout,
}: {
  initialLayout: ProfileBlock[];
}) {
  const [blocks, setBlocks] = useState<ProfileBlock[]>(initialLayout);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    setBlocks((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function update(id: ProfileBlockId, patch: Partial<Pick<ProfileBlock, "visible" | "width">>) {
    setBlocks((prev) =>
      prev.map((block) => (block.id === id ? { ...block, ...patch } : block))
    );
  }

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/profile/layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout: blocks }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Не удалось сохранить");
      setMessage("Раскладка сохранена");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сети");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p className="border-2 border-black bg-[rgba(214,69,69,0.14)] px-3 py-2 text-sm text-[var(--mc-red)]">
          {error}
        </p>
      )}
      {message && (
        <p className="border-2 border-black bg-[rgba(93,156,60,0.16)] px-3 py-2 text-sm text-[var(--mc-green-light)]">
          {message}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {blocks.map((block, index) => {
          const meta = LABELS.get(block.id);
          return (
            <li
              key={block.id}
              className={`flex flex-wrap items-center gap-2 border-2 border-black bg-[var(--card)] px-3 py-2 ${
                block.visible ? "" : "opacity-55"
              }`}
            >
              <span className="w-5 shrink-0 text-center font-mono text-[0.6rem] text-[var(--text-muted)]">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{meta?.label ?? block.id}</div>
                <div className="text-[0.6rem] text-[var(--text-muted)]">
                  {HINTS.get(block.id)}
                </div>
              </div>

              <select
                value={block.width}
                onChange={(event) =>
                  update(block.id, {
                    width: event.target.value === "full" ? "full" : "half",
                  })
                }
                className="mc-input w-auto py-1 text-[0.68rem]"
                aria-label={`Ширина блока ${meta?.label ?? block.id}`}
              >
                <option value="half">Половина</option>
                <option value="full">Вся ширина</option>
              </select>

              <label className="flex cursor-pointer items-center gap-1.5 text-[0.68rem] text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={block.visible}
                  onChange={(event) => update(block.id, { visible: event.target.checked })}
                  className="h-4 w-4 accent-[var(--mc-green)]"
                />
                Виден
              </label>

              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  className="mc-btn px-2 py-1 text-[0.65rem]"
                  aria-label="Выше"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === blocks.length - 1}
                  className="mc-btn px-2 py-1 text-[0.65rem]"
                  aria-label="Ниже"
                >
                  ↓
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="mc-btn mc-btn-primary px-3 py-1.5 text-xs"
        >
          {saving ? "Сохраняем…" : "Сохранить раскладку"}
        </button>
        <button
          type="button"
          onClick={() => {
            setBlocks(DEFAULT_PROFILE_LAYOUT.map((block) => ({ ...block })));
            setMessage(null);
            setError(null);
          }}
          className="mc-btn px-3 py-1.5 text-xs"
        >
          Сбросить
        </button>
      </div>
      <p className="text-xs text-[var(--text-muted)]">
        Порядок блоков общий для всех, кто смотрит профиль. Скрытые блоки не
        показываются никому.
      </p>
    </div>
  );
}
