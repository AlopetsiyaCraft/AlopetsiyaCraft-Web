"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import PlayerHead from "@/components/mc/PlayerHead";
import { Panel, PanelHead } from "@/components/mc/Panel";

interface Player {
  id: number;
  nickname: string;
  skinUrl: string | null;
  status: "server" | "site" | "offline";
}

function StatusMark({ status }: { status: Player["status"] }) {
  if (status === "server") {
    return (
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping bg-[var(--mc-green-light)] opacity-70" />
        <span className="relative inline-flex h-2.5 w-2.5 bg-[var(--mc-green-light)]" />
      </span>
    );
  }
  if (status === "site") {
    return <span className="h-2.5 w-2.5 shrink-0 bg-[var(--mc-green)]" />;
  }
  return <span className="h-2.5 w-2.5 shrink-0 bg-[#555]" />;
}

export default function PlayersOnline() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchPlayers() {
    try {
      const res = await fetch("/api/players");
      if (res.ok) {
        const data = await res.json();
        setPlayers(data);
      }
    } catch (error) {
      console.error("Failed to fetch players:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPlayers();
    const interval = setInterval(fetchPlayers, 10000);
    return () => clearInterval(interval);
  }, []);

  const onlineCount = players.filter((p) => p.status !== "offline").length;
  const sorted = [...players].sort((a, b) => {
    const rank = { server: 0, site: 1, offline: 2 } as const;
    return rank[a.status] - rank[b.status] || a.nickname.localeCompare(b.nickname);
  });

  return (
    <Panel className="overflow-hidden">
      <PanelHead
        title={
          <>
            Игроки <span className="text-[var(--mc-green-light)]">{players.length}</span>
          </>
        }
        icon={
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
            <path strokeLinecap="square" d="M16 20v-1a4 4 0 00-4-4H6a4 4 0 00-4 4v1M9 11a4 4 0 100-8 4 4 0 000 8m13 9v-1a4 4 0 00-3-3.87M16 3.13A4 4 0 0119 7a4 4 0 01-3 3.87" />
          </svg>
        }
        right={
          <span className="mc-chip text-[0.6rem] text-[var(--mc-green-light)]">
            {onlineCount > 0 ? `${onlineCount} в сети` : "никого"}
          </span>
        }
      />

      <div className="max-h-80 overflow-y-auto p-2 custom-scrollbar">
        {loading ? (
          <div className="py-6 text-center text-sm text-[var(--text-muted)]">Загрузка…</div>
        ) : players.length === 0 ? (
          <div className="py-6 text-center text-sm text-[var(--text-muted)]">Пока нет игроков</div>
        ) : (
          <ul className="space-y-0.5">
            {sorted.map((player) => (
              <li key={player.id}>
                <Link
                  href={`/profile/${encodeURIComponent(player.nickname)}`}
                  className="flex items-center gap-2.5 border-2 border-transparent px-1.5 py-1.5 transition-colors hover:border-black hover:bg-[var(--hover)]"
                >
                  <PlayerHead skinUrl={player.skinUrl} nickname={player.nickname} size={32} />
                  <span className={`min-w-0 flex-1 truncate text-sm ${player.status === "offline" ? "text-[var(--text-muted)]" : "text-[var(--text)]"}`}>
                    {player.nickname}
                  </span>
                  <StatusMark status={player.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}
