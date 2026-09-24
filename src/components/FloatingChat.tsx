"use client";

import { useSession } from "next-auth/react";
import LiveChat from "./LiveChat";
import { useChatDock } from "@/lib/chat-dock";

/**
 * Плавающее окно чата в правом нижнем углу — видно на всех страницах,
 * пока чат откреплён от главной (как сообщения во VK).
 */
export default function FloatingChat() {
  const { pinned } = useChatDock();
  const { data: session } = useSession();

  if (pinned) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[380px] max-w-[calc(100vw-2rem)]">
      <div className="rounded-lg shadow-2xl">
        <LiveChat isLoggedIn={!!session?.user} />
      </div>
    </div>
  );
}