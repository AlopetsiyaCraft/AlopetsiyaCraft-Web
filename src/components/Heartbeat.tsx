"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";

export default function Heartbeat() {
  const { data: session } = useSession();

  useEffect(() => {
    if (!session) return;

    async function sendHeartbeat() {
      try {
        await fetch("/api/user/heartbeat", { method: "POST" });
      } catch {}
    }

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 20000);
    return () => clearInterval(interval);
  }, [session]);

  return null;
}
