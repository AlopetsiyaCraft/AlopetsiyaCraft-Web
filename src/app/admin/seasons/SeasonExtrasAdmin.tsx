"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export interface AdminSeasonEvent {
  id: number;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  icon: string;
}

export interface AdminSeasonReward {
  id: number;
  title: string;
  description: string | null;
  place: number | null;
  rewardBld: number;
  rewardChips: number;
}

export interface AdminSeasonResult {
  id: number;
  place: number;
  nickname: string;
  note: string | null;
  rewardBld: number;
  rewardChips: number;
}

function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export default function SeasonExtrasAdmin({
  seasonId,
  events,
  rewards,
  results,
}: {
  seasonId: number;
  events: AdminSeasonEvent[];
  rewards: AdminSeasonReward[];
  results: AdminSeasonResult[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [event, setEvent] = useState({
    title: "",
    description: "",
    startsAt: "",
    endsAt: "",
    icon: "📌",
  });
  const [reward, setReward] = useState({
    title: "",
    description: "",
    place: "",
    rewardBld: "0",
    rewardChips: "0",
  });
  const [result, setResult] = useState({
    place: "1",
    nickname: "",
    note: "",
    rewardBld: "0",
    rewardChips: "0",
  });

  async function call(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/seasons/extras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seasonId, ...body }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) throw new Error(data.error || "Не удалось сохранить");
      setMessage(data.message ?? "Сохранено");
      router.refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сети");
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
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

      <section className="mc-panel overflow-hidden">
        <div className="mc-head">Таймлайн</div>
        <div className="flex flex-col gap-3 p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              value={event.icon}
              onChange={(e) => setEvent({ ...event, icon: e.target.value })}
              className="mc-input py-1 text-xs"
              placeholder="Иконка"
              maxLength={8}
            />
            <input
              value={event.title}
              onChange={(e) => setEvent({ ...event, title: e.target.value })}
              className="mc-input py-1 text-xs"
              placeholder="Название события"
            />
            <input
              type="datetime-local"
              value={event.startsAt}
              onChange={(e) => setEvent({ ...event, startsAt: e.target.value })}
              className="mc-input py-1 text-xs"
            />
            <input
              type="datetime-local"
              value={event.endsAt}
              onChange={(e) => setEvent({ ...event, endsAt: e.target.value })}
              className="mc-input py-1 text-xs"
            />
            <textarea
              value={event.description}
              onChange={(e) => setEvent({ ...event, description: e.target.value })}
              rows={2}
              className="mc-input py-1 text-xs sm:col-span-2"
              placeholder="Описание"
            />
          </div>
          <button
            type="button"
            disabled={busy || !event.title || !event.startsAt}
            onClick={async () => {
              if (await call({ type: "event", action: "save", ...event })) {
                setEvent({ title: "", description: "", startsAt: "", endsAt: "", icon: "📌" });
              }
            }}
            className="mc-btn mc-btn-primary w-fit px-3 py-1.5 text-xs disabled:opacity-55"
          >
            Добавить событие
          </button>

          <ul className="flex flex-col divide-y-2 divide-black/30">
            {events.map((item) => (
              <li key={item.id} className="flex items-center gap-2 py-1.5 text-xs">
                <span>{item.icon}</span>
                <span className="min-w-0 flex-1 truncate">{item.title}</span>
                <span className="font-mono text-[0.58rem] text-[var(--text-muted)]">
                  {formatDate(item.startsAt)}
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void call({ type: "event", action: "delete", id: item.id })}
                  className="text-[var(--mc-red)]"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mc-panel overflow-hidden">
        <div className="mc-head">Награды</div>
        <div className="flex flex-col gap-3 p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <input
              value={reward.title}
              onChange={(e) => setReward({ ...reward, title: e.target.value })}
              className="mc-input py-1 text-xs"
              placeholder="Название награды"
            />
            <input
              value={reward.place}
              onChange={(e) => setReward({ ...reward, place: e.target.value })}
              className="mc-input py-1 text-xs"
              placeholder="Место (пусто = активность)"
            />
            <input
              value={reward.rewardBld}
              onChange={(e) => setReward({ ...reward, rewardBld: e.target.value })}
              className="mc-input py-1 text-xs"
              placeholder="BLD"
            />
            <input
              value={reward.rewardChips}
              onChange={(e) => setReward({ ...reward, rewardChips: e.target.value })}
              className="mc-input py-1 text-xs"
              placeholder="Фишки"
            />
            <input
              value={reward.description}
              onChange={(e) => setReward({ ...reward, description: e.target.value })}
              className="mc-input py-1 text-xs sm:col-span-2"
              placeholder="Описание"
            />
          </div>
          <button
            type="button"
            disabled={busy || !reward.title}
            onClick={async () => {
              if (await call({ type: "reward", action: "save", ...reward })) {
                setReward({ title: "", description: "", place: "", rewardBld: "0", rewardChips: "0" });
              }
            }}
            className="mc-btn mc-btn-primary w-fit px-3 py-1.5 text-xs disabled:opacity-55"
          >
            Добавить награду
          </button>
          <ul className="flex flex-col divide-y-2 divide-black/30">
            {rewards.map((item) => (
              <li key={item.id} className="flex items-center gap-2 py-1.5 text-xs">
                <span className="min-w-0 flex-1 truncate">
                  {item.place != null ? `#${item.place} · ` : ""}
                  {item.title}
                </span>
                <span className="font-mono text-[0.58rem] text-[var(--mc-gold)]">
                  {item.rewardBld > 0 ? `${item.rewardBld} BLD` : ""}
                  {item.rewardChips > 0 ? ` ${item.rewardChips} фишек` : ""}
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void call({ type: "reward", action: "delete", id: item.id })}
                  className="text-[var(--mc-red)]"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mc-panel overflow-hidden">
        <div className="mc-head">Победители</div>
        <div className="flex flex-col gap-3 p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <input
              value={result.place}
              onChange={(e) => setResult({ ...result, place: e.target.value })}
              className="mc-input py-1 text-xs"
              placeholder="Место"
            />
            <input
              value={result.nickname}
              onChange={(e) => setResult({ ...result, nickname: e.target.value })}
              className="mc-input py-1 text-xs"
              placeholder="Ник"
            />
            <input
              value={result.note}
              onChange={(e) => setResult({ ...result, note: e.target.value })}
              className="mc-input py-1 text-xs"
              placeholder="Комментарий"
            />
            <input
              value={result.rewardBld}
              onChange={(e) => setResult({ ...result, rewardBld: e.target.value })}
              className="mc-input py-1 text-xs"
              placeholder="BLD"
            />
            <input
              value={result.rewardChips}
              onChange={(e) => setResult({ ...result, rewardChips: e.target.value })}
              className="mc-input py-1 text-xs"
              placeholder="Фишки"
            />
          </div>
          <button
            type="button"
            disabled={busy || !result.nickname}
            onClick={async () => {
              if (await call({ type: "result", action: "save", ...result })) {
                setResult({ place: "1", nickname: "", note: "", rewardBld: "0", rewardChips: "0" });
              }
            }}
            className="mc-btn mc-btn-primary w-fit px-3 py-1.5 text-xs disabled:opacity-55"
          >
            Добавить итог
          </button>
          <ul className="flex flex-col divide-y-2 divide-black/30">
            {results.map((item) => (
              <li key={item.id} className="flex items-center gap-2 py-1.5 text-xs">
                <span className="font-mono text-[0.62rem] text-[var(--mc-gold)]">
                  #{item.place}
                </span>
                <span className="min-w-0 flex-1 truncate">{item.nickname}</span>
                <span className="font-mono text-[0.58rem] text-[var(--text-muted)]">
                  {item.rewardBld > 0 ? `${item.rewardBld} BLD` : ""}
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void call({ type: "result", action: "delete", id: item.id })}
                  className="text-[var(--mc-red)]"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
