"use client";

import { useCallback, useEffect, useState } from "react";
import type { FriendsResponse, FriendUser } from "@/lib/profile";

function FriendAvatar({ user, size = 48 }: { user: FriendUser; size?: number }) {
  return (
    <div
      className="rounded-lg overflow-hidden shrink-0 bg-[#7c3aed]/20 flex items-center justify-center font-bold"
      style={{ width: size, height: size }}
    >
      {user.skinUrl ? (
        <div
          className="w-full h-full"
          style={{
            backgroundImage: `url(${user.skinUrl})`,
            backgroundSize: `${size * 4}px ${size * 4}px`,
            backgroundPosition: `-${size}px -${size}px`,
            imageRendering: "pixelated",
          }}
        />
      ) : (
        user.nickname[0]?.toUpperCase() ?? "?"
      )}
    </div>
  );
}

/** Вкладка «Друзья»: список, заявки, поиск и добавление. */
export default function FriendsTab({ viewerNickname }: { viewerNickname: string }) {
  const [data, setData] = useState<FriendsResponse>({ accepted: [], incoming: [], outgoing: [] });
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<Array<FriendUser & { isFriend?: boolean }>>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/friends");
      if (res.ok) setData((await res.json()) as FriendsResponse);
    } catch {
      /* и так покажем пусто */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function search() {
    if (searchQ.trim().length < 2) return;
    setMessage(null);
    const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchQ.trim())}`);
    if (res.ok) {
      const results = (await res.json()) as Array<FriendUser>;
      setSearchResults(results.filter((u) => u.nickname !== viewerNickname));
    }
  }

  async function sendRequest(nickname: string) {
    setBusyId(0);
    setMessage(null);
    try {
      const res = await fetch("/api/friends/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname }),
      });
      const j = await res.json().catch(() => null);
      setMessage(res.ok ? (j?.message ?? "Заявка отправлена") : (j?.error ?? "Ошибка"));
      if (res.ok) {
        setSearchQ("");
        setSearchResults([]);
        refresh();
      }
    } finally {
      setBusyId(null);
    }
  }

  async function respond(userId: number, accept: boolean) {
    setBusyId(userId);
    setMessage(null);
    try {
      const res = await fetch("/api/friends/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendUserId: userId, accept }),
      });
      if (res.ok) {
        setMessage(accept ? "Вы друзья!" : "Заявка отклонена");
        refresh();
      } else {
        const j = await res.json().catch(() => null);
        setMessage(j?.error ?? "Ошибка");
      }
    } finally {
      setBusyId(null);
    }
  }

  async function remove(userId: number) {
    setBusyId(userId);
    setMessage(null);
    try {
      const res = await fetch(`/api/friends/${userId}`, { method: "DELETE" });
      if (res.ok) {
        setMessage("Готово");
        refresh();
      }
    } finally {
      setBusyId(null);
    }
  }

  const userRow = (u: FriendUser & { since?: number }) => (
    <div key={u.id} className="flex items-center gap-3 bg-[var(--card)] border border-[var(--border)] rounded-lg p-3">
      <FriendAvatar user={u} />
      <a href={`/profile/${encodeURIComponent(u.nickname)}`} className="flex-1 min-w-0 font-medium text-sm hover:text-[#7c3aed] truncate">
        {u.nickname}
        {u.since ? <span className="block text-xs text-[var(--text-muted)] font-normal">в друзьях с {new Date(u.since).toLocaleDateString("ru-RU")}</span> : null}
      </a>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Друзья</h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">Приглашайте игроков по нику — как во VK.</p>
      </div>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
        <h3 className="text-sm font-semibold mb-3">Добавить в друзья</h3>
        <div className="flex gap-2">
          <input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") search();
            }}
            placeholder="Ник или часть ника"
            className="flex-1 px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[#7c3aed]"
          />
          <button
            onClick={search}
            disabled={searchQ.trim().length < 2}
            className="px-4 py-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm rounded-lg disabled:opacity-50"
          >
            Найти
          </button>
        </div>

        {searchResults.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {searchResults.map((u) => (
              <div key={u.id} className="flex items-center gap-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-1.5">
                <FriendAvatar user={u} size={28} />
                <span className="text-sm">{u.nickname}</span>
                <button
                  onClick={() => sendRequest(u.nickname)}
                  disabled={busyId !== null}
                  className="px-2 py-1 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs rounded disabled:opacity-50"
                >
                  {data.accepted.some((f) => f.id === u.id)
                    ? "В друзьях"
                    : data.outgoing.some((f) => f.id === u.id)
                      ? "Заявка отправлена"
                      : data.incoming.some((f) => f.id === u.id)
                        ? "Заявка вам"
                        : "Добавить"}
                </button>
              </div>
            ))}
          </div>
        )}
        {message && <p className="mt-2 text-sm text-[var(--text-secondary)]">{message}</p>}
      </div>

      {loading ? (
        <div className="text-[var(--text-muted)] text-sm py-8 text-center">Загрузка…</div>
      ) : (
        <>
          <section>
            <h2 className="text-lg font-semibold mb-3">
              Мои друзья <span className="text-[var(--text-muted)] text-sm font-normal">({data.accepted.length})</span>
            </h2>
            {data.accepted.length === 0 ? (
              <p className="text-[var(--text-muted)] text-sm">У вас пока нет друзей.</p>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.accepted.map((u) => (
                  <div key={u.id} className="relative">
                    {userRow(u)}
                    <button
                      onClick={() => remove(u.id)}
                      disabled={busyId === u.id}
                      className="absolute top-2 right-2 text-[var(--text-muted)] hover:text-red-400 text-xs"
                      title="Удалить из друзей"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {data.incoming.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-3">
                Входящие заявки <span className="text-[var(--text-muted)] text-sm font-normal">({data.incoming.length})</span>
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.incoming.map((u) => (
                  <div key={u.id} className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 flex items-center gap-3">
                    <FriendAvatar user={u} />
                    <div className="flex-1 min-w-0">
                      <a href={`/profile/${encodeURIComponent(u.nickname)}`} className="font-medium text-sm hover:text-[#7c3aed] truncate block">
                        {u.nickname}
                      </a>
                      <div className="flex gap-2 mt-1">
                        <button
                          onClick={() => respond(u.id, true)}
                          disabled={busyId === u.id}
                          className="px-2 py-1 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs rounded disabled:opacity-50"
                        >
                          Принять
                        </button>
                        <button
                          onClick={() => respond(u.id, false)}
                          disabled={busyId === u.id}
                          className="px-2 py-1 bg-[var(--bg)] border border-[var(--border)] text-xs rounded hover:border-[var(--text-muted)] disabled:opacity-50"
                        >
                          Отклонить
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {data.outgoing.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-3">
                Исходящие заявки <span className="text-[var(--text-muted)] text-sm font-normal">({data.outgoing.length})</span>
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.outgoing.map((u) => (
                  <div key={u.id} className="relative">
                    {userRow(u)}
                    <button
                      onClick={() => remove(u.id)}
                      disabled={busyId === u.id}
                      className="absolute top-2 right-2 text-[var(--text-muted)] hover:text-red-400 text-xs"
                      title="Отменить заявку"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}