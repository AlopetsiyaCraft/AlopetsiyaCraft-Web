"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export interface AdminSeason {
  id: number;
  number: number;
  name: string;
  description: string | null;
  modpackUrl: string | null;
  isActive: boolean;
}

interface SaveState {
  saving: boolean;
  error: string | null;
  message: string | null;
}

function useSeasonSave() {
  const router = useRouter();
  const [state, setState] = useState<SaveState>({
    saving: false,
    error: null,
    message: null,
  });

  async function save(body: Record<string, unknown>) {
    setState({ saving: true, error: null, message: null });
    try {
      const res = await fetch("/api/admin/seasons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) throw new Error(data.error || "Не удалось сохранить");
      setState({ saving: false, error: null, message: data.message ?? "Сохранено" });
      router.refresh();
    } catch (e) {
      setState({
        saving: false,
        error: e instanceof Error ? e.message : "Ошибка",
        message: null,
      });
    }
  }

  return { ...state, save };
}

function SeasonFields({ season }: { season: AdminSeason }) {
  return (
    <>
      <label className="flex flex-col gap-1 text-[0.58rem] uppercase tracking-[0.1em] text-[var(--text-muted)]">
        Номер
        <input
          name="number"
          type="number"
          min={1}
          defaultValue={season.number}
          className="mc-input py-1 text-xs"
        />
      </label>
      <label className="flex flex-col gap-1 text-[0.58rem] uppercase tracking-[0.1em] text-[var(--text-muted)]">
        Название
        <input
          name="name"
          defaultValue={season.name}
          required
          className="mc-input py-1 text-xs"
        />
      </label>
      <label className="flex flex-col gap-1 text-[0.58rem] uppercase tracking-[0.1em] text-[var(--text-muted)] sm:col-span-2">
        Описание
        <input
          name="description"
          defaultValue={season.description ?? ""}
          className="mc-input py-1 text-xs"
        />
      </label>
      <label className="flex flex-col gap-1 text-[0.58rem] uppercase tracking-[0.1em] text-[var(--text-muted)] sm:col-span-2">
        Ссылка на модпак
        <input
          name="modpackUrl"
          defaultValue={season.modpackUrl ?? ""}
          className="mc-input py-1 text-xs"
        />
      </label>
      <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] sm:col-span-2">
        <input
          name="isActive"
          type="checkbox"
          defaultChecked={season.isActive}
          className="h-4 w-4 accent-[var(--mc-green)]"
        />
        Сделать активным (остальные станут архивом)
      </label>
    </>
  );
}

export default function AdminSeasons({
  initialSeasons,
}: {
  initialSeasons: AdminSeason[];
}) {
  const nextNumber =
    initialSeasons.reduce((max, season) => Math.max(max, season.number), 0) + 1;
  const create = useSeasonSave();

  return (
    <div className="flex flex-col gap-4">
      <section className="mc-panel overflow-hidden">
        <div className="mc-head">Новый сезон</div>
        <form
          className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            void create.save({
              number: Number(form.get("number")),
              name: form.get("name"),
              description: form.get("description"),
              modpackUrl: form.get("modpackUrl"),
              isActive: form.get("isActive") === "on",
            });
            e.currentTarget.reset();
          }}
        >
          <label className="flex flex-col gap-1 text-[0.58rem] uppercase tracking-[0.1em] text-[var(--text-muted)]">
            Номер
            <input
              name="number"
              type="number"
              min={1}
              defaultValue={nextNumber}
              className="mc-input py-1 text-xs"
            />
          </label>
          <label className="flex flex-col gap-1 text-[0.58rem] uppercase tracking-[0.1em] text-[var(--text-muted)]">
            Название
            <input name="name" required className="mc-input py-1 text-xs" />
          </label>
          <label className="flex flex-col gap-1 text-[0.58rem] uppercase tracking-[0.1em] text-[var(--text-muted)] sm:col-span-2">
            Описание
            <input name="description" className="mc-input py-1 text-xs" />
          </label>
          <label className="flex flex-col gap-1 text-[0.58rem] uppercase tracking-[0.1em] text-[var(--text-muted)] sm:col-span-2">
            Ссылка на модпак
            <input name="modpackUrl" className="mc-input py-1 text-xs" />
          </label>
          <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] sm:col-span-2">
            <input
              name="isActive"
              type="checkbox"
              className="h-4 w-4 accent-[var(--mc-green)]"
            />
            Сразу сделать активным
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={create.saving}
              className="mc-btn mc-btn-primary px-3 py-1.5 text-xs"
            >
              {create.saving ? "Создаём…" : "Создать сезон"}
            </button>
          </div>
          {create.error && (
            <p className="text-xs text-[var(--mc-red)] sm:col-span-2">{create.error}</p>
          )}
          {create.message && (
            <p className="text-xs text-[var(--mc-green-light)] sm:col-span-2">
              {create.message}
            </p>
          )}
        </form>
      </section>

      {initialSeasons.map((season) => (
        <SeasonCard key={season.id} season={season} />
      ))}
    </div>
  );
}

function SeasonCard({ season }: { season: AdminSeason }) {
  const save = useSeasonSave();

  return (
    <section className="mc-panel overflow-hidden">
      <div className="mc-head">
        <span className="min-w-0 flex-1 truncate">
          Сезон {season.number} · {season.name}
        </span>
        {season.isActive && (
          <span className="mc-chip text-[0.58rem] text-[var(--mc-green-light)]">
            Активный
          </span>
        )}
        <a
          href={`/admin/seasons/${season.number}`}
          className="mc-chip text-[0.58rem] text-[var(--text-secondary)] hover:bg-[var(--hover)]"
        >
          События и итоги
        </a>
      </div>
      <form
        className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          void save.save({
            id: season.id,
            number: Number(form.get("number")),
            name: form.get("name"),
            description: form.get("description"),
            modpackUrl: form.get("modpackUrl"),
            isActive: form.get("isActive") === "on",
          });
        }}
      >
        <SeasonFields season={season} />
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={save.saving}
            className="mc-btn mc-btn-primary px-3 py-1.5 text-xs"
          >
            {save.saving ? "Сохраняем…" : "Сохранить сезон"}
          </button>
        </div>
        {save.error && (
          <p className="text-xs text-[var(--mc-red)] sm:col-span-2">{save.error}</p>
        )}
        {save.message && (
          <p className="text-xs text-[var(--mc-green-light)] sm:col-span-2">
            {save.message}
          </p>
        )}
      </form>
    </section>
  );
}
