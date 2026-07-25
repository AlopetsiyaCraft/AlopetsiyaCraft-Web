"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Player {
  id: number;
  nickname: string;
  skinUrl: string | null;
  status: "server" | "site" | "offline";
}

function StatusDot({ status }: { status: Player["status"] }) {
  if (status === "server") {
    return (
      <span className="relative flex h-3 w-3">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
      </span>
    );
  }

  if (status === "site") {
    return (
      <span className="relative flex h-3 w-3">
        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
      </span>
    );
  }

  return (
    <span className="relative flex h-3 w-3">
      <span className="relative inline-flex rounded-full h-3 w-3 bg-gray-500" />
    </span>
  );
}

function StatusText({ status }: { status: Player["status"] }) {
  if (status === "server") {
    return <span className="text-xs text-green-400">Онлайн</span>;
  }
  if (status === "site") {
    return <span className="text-xs text-green-400">Онлайн на сайте</span>;
  }
  return null;
}

function PlayerHead({ skinUrl, nickname }: { skinUrl: string | null; nickname: string }) {
  if (!skinUrl) {
    return (
      <div className="w-10 h-10 bg-[#7c3aed] rounded flex items-center justify-center text-sm font-bold">
        {nickname[0]?.toUpperCase() || "?"}
      </div>
    );
  }

  return (
    <div className="w-10 h-10 rounded relative overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${skinUrl})`,
          backgroundSize: "320px 320px",
          backgroundPosition: "-40px -40px",
          imageRendering: "pixelated",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${skinUrl})`,
          backgroundSize: "320px 320px",
          backgroundPosition: "-200px -40px",
          imageRendering: "pixelated",
        }}
      />
    </div>
  );
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

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--border)]">
        <h2 className="font-semibold">
          Игроков:{" "}
          <span className="text-[#7c3aed]">{players.length}</span>
          {onlineCount > 0 && (
            <span className="text-[var(--text-muted)] font-normal ml-2">
              (в сети: {onlineCount})
            </span>
          )}
        </h2>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="text-center text-[var(--text-muted)] py-4">
            Загрузка...
          </div>
        ) : players.length === 0 ? (
          <div className="text-center text-[var(--text-muted)] py-4">
            Пока нет игроков
          </div>
        ) : (
          <div className="space-y-1">
            {players.map((player) => (
              <Link
                key={player.id}
                href={`/profile?user=${player.nickname}`}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--hover)] transition-colors"
              >
                <div className="flex-shrink-0">
                  <PlayerHead skinUrl={player.skinUrl} nickname={player.nickname} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{player.nickname}</span>
                    <StatusDot status={player.status} />
                  </div>
                  <StatusText status={player.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
