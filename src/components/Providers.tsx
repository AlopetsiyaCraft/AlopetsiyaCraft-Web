"use client";

import { SessionProvider } from "next-auth/react";
import Heartbeat from "./Heartbeat";
import FloatingChat from "./FloatingChat";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <Heartbeat />
      <FloatingChat />
      {children}
    </SessionProvider>
  );
}