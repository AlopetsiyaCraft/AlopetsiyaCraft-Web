"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import UploadModal from "./UploadModal";

interface Track {
  id: number;
  title: string;
  artist: string | null;
  size: number;
  createdAt: number;
  url: string;
  coverUrl: string | null;
  coverThumbUrl: string | null;
}

interface DiscState {
  state: "pending" | "done" | "failed";
  error?: string;
}

const POLL_TIMEOUTS = 30; // 30 × 2 c = до минуты ждём ответа сервера

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} МБ`
    : `${Math.max(1, Math.round(bytes / 1024))} КБ`;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function PlayIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9a1 1 0 012 0v6a1 1 0 11-2 0V9zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V9z" />
    </svg>
  );
}

export default function MyAudio({
  isOwn,
  targetNickname,
}: {
  isOwn: boolean;
  targetNickname: string;
}) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [durations, setDurations] = useState<Record<number, number>>({});
  const [disc, setDisc] = useState<Record<number, DiscState>>({});
  const [query, setQuery] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/audio?user=${encodeURIComponent(targetNickname)}`);
      if (!res.ok) throw new Error("Пользователь не найден");
      const data = (await res.json()) as Track[];
      if (!mountedRef.current) return;
      setTracks(data);
      setLoading(false);
    } catch {
      if (mountedRef.current) {
        setLoadError("Не удалось загрузить список аудио");
        setLoading(false);
      }
    }
  }, [targetNickname]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tracks;
    return tracks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.artist ? t.artist.toLowerCase().includes(q) : false)
    );
  }, [tracks, query]);

  function togglePlay(track: Track) {
    const audio = audioRef.current;
    if (!audio) return;
    if (playingId === track.id) {
      audio.pause();
      setPlayingId(null);
      return;
    }
    if (audio.src) audio.pause();
    audio.src = track.url;
    audio.play().then(() => setPlayingId(track.id)).catch(() => setPlayingId(null));
  }

  async function makeDisc(track: Track) {
    setDisc((prev) => ({ ...prev, [track.id]: { state: "pending" } }));
    let requestId: number | null = null;
    try {
      const res = await fetch(`/api/audio/${track.id}/disc`, { method: "POST" });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error || "Не удалось создать заявку");
      }
      const body = (await res.json()) as { requestId: number };
      requestId = body.requestId;

      for (let i = 0; i < POLL_TIMEOUTS; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        if (!mountedRef.current) return;
        const st = await fetch(`/api/audio/request/${requestId}`);
        if (!st.ok) continue;
        const sj = (await st.json()) as { status: string; error?: string | null };
        if (sj.status === "done") {
          setDisc((prev) => ({ ...prev, [track.id]: { state: "done" } }));
          return;
        }
        if (sj.status === "failed") {
          setDisc((prev) => ({ ...prev, [track.id]: { state: "failed", error: sj.error ?? undefined } }));
          return;
        }
      }
      throw new Error("Сервер не ответил за минуту. Попробуй ещё раз, когда будешь онлайн в игре.");
    } catch (e) {
      if (mountedRef.current) {
        setDisc((prev) => ({
          ...prev,
          [track.id]: { state: "failed", error: e instanceof Error ? e.message : "Ошибка" },
        }));
      }
    }
  }

  async function deleteTrack(track: Track) {
    if (!window.confirm(`Удалить «${track.title}»?`)) return;
    const res = await fetch(`/api/audio/${track.id}`, { method: "DELETE" });
    if (res.ok) {
      if (playingId === track.id && audioRef.current) {
        audioRef.current.pause();
        setPlayingId(null);
      }
      await refresh();
    }
  }

  const discButton = (track: Track) => {
    const state = disc[track.id];
    if (state?.state === "done") {
      return (
        <span className="text-green-500 text-xs font-medium whitespace-nowrap">Пластинка выдана!</span>
      );
    }
    if (state?.state === "pending") {
      return (
        <span className="text-[var(--text-muted)] text-xs whitespace-nowrap animate-pulse">Выдаём…</span>
      );
    }
    return (
      <button
        onClick={() => makeDisc(track)}
        className="px-3 py-1.5 rounded-lg bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs font-medium transition-colors whitespace-nowrap"
        title="Выдать пластинку с этой песней в игре (нужно быть онлайн)"
      >
        💿 Пластинка
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">
          {isOwn ? "Мои аудио" : <>Аудио: <span className="text-[#7c3aed]">{targetNickname}</span></>}
          <span className="text-[var(--text-muted)] text-sm font-normal ml-2">({tracks.length})</span>
        </h1>
        {isOwn ? (
          <p className="text-[var(--text-muted)] text-sm mt-1">
            Нажимай «Загрузить песню» — внутри выбери песню (.mp3) и фото обложки:
            обложка кадрируется в квадрате 1:1 (на сайте — обычная фотка), а на
            пластинке в игре станет пиксельной (16×16).
          </p>
        ) : (
          <p className="text-[var(--text-muted)] text-sm mt-1">Публичная библиотека игрока.</p>
        )}
      </div>

      {isOwn && (
        <div className="flex items-center gap-3">
          <div className="relative flex-1 min-w-0">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
              </svg>
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по своим песням…"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] pl-9 pr-3 py-2 text-sm text-[var(--text-secondary)] outline-none focus:border-[#7c3aed] transition-colors"
            />
          </div>
          <button
            onClick={() => setUploadOpen(true)}
            className="shrink-0 px-4 py-2 rounded-lg bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm font-medium transition-colors"
            title="Загрузить новую песню с обложкой"
          >
            Загрузить песню
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-[var(--text-muted)] text-sm py-8 text-center">Загрузка…</div>
      ) : loadError ? (
        <div className="text-red-400 text-sm py-8 text-center">{loadError}</div>
      ) : tracks.length === 0 ? (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg py-10 text-center text-[var(--text-muted)] text-sm">
          {isOwn
            ? "Пока пусто. Нажми «Загрузить песню» и добавь первую!"
            : "У этого игрока пока нет аудио."}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg py-10 text-center text-[var(--text-muted)] text-sm">
          Ничего не найдено по запросу «{query}».
        </div>
      ) : (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg divide-y divide-[var(--border)]">
          {filtered.map((track, i) => {
            const isPlaying = playingId === track.id;
            const dState = disc[track.id];
            return (
              <div key={track.id} className="flex items-center gap-3 px-4 py-3">
                <span className="w-5 text-right text-[var(--text-muted)] text-xs">{i + 1}</span>

                <button
                  onClick={() => togglePlay(track)}
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-[#7c3aed] hover:bg-[#6d28d9] text-white transition-colors"
                  title={isPlaying ? "Пауза" : "Слушать"}
                >
                  {isPlaying ? <PauseIcon /> : <PlayIcon />}
                </button>

                {track.coverThumbUrl && (
                  <div className="w-9 h-9 rounded border border-[var(--border)] overflow-hidden shrink-0 bg-[var(--hover)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={track.coverThumbUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{track.title}</div>
                  <div className="text-[var(--text-muted)] text-xs">
                    {formatSize(track.size)}
                    {durations[track.id] ? ` · ${formatDuration(durations[track.id])}` : ""}
                    {i === 0 ? " · недавно" : ""}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isOwn && discButton(track)}
                  {isOwn && dState?.state === "failed" && (
                    <span className="text-red-400 text-xs max-w-[220px] truncate" title={dState.error}>
                      {dState.error || "Не вышло"}
                    </span>
                  )}
                  {isOwn && (
                    <button
                      onClick={() => deleteTrack(track)}
                      className="p-2 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-[var(--hover)] transition-colors"
                      title="Удалить"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {uploadOpen && (
        <UploadModal
          onClose={() => setUploadOpen(false)}
          onUploaded={() => {
            setUploadOpen(false);
            refresh();
          }}
        />
      )}

      <audio
        ref={audioRef}
        onLoadedMetadata={(e) => {
          const el = e.currentTarget;
          const src = el.getAttribute("src");
          if (src) {
            const m = src.match(/\/api\/audio\/(\d+)\/file/);
            if (m) {
              setDurations((prev) => ({ ...prev, [parseInt(m[1], 10)]: el.duration }));
            }
          }
        }}
        onPause={() => setPlayingId(null)}
        onEnded={() => setPlayingId(null)}
      />
    </div>
  );
}