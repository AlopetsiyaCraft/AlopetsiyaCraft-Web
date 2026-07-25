"use client";

import { SessionProvider } from "next-auth/react";
import Heartbeat from "./Heartbeat";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <Heartbeat />
      {children}
    </SessionProvider>
  );
}
