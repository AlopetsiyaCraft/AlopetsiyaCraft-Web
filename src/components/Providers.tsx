"use client";

import { SessionProvider } from "next-auth/react";
import Heartbeat from "./Heartbeat";
import FloatingChat from "./FloatingChat";
import PlayerProvider from "./player/PlayerProvider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <PlayerProvider>
        <Heartbeat />
        <FloatingChat />
        {children}
      </PlayerProvider>
    </SessionProvider>
  );
}
