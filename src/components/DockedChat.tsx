"use client";

import LiveChat from "./LiveChat";
import { useChatDock } from "@/lib/chat-dock";

/**
 * Чат в ленте главной страницы. Показывается только когда чат закреплён
 * (pinned); после открепления вместо него на всех страницах плавающее окно.
 */
export default function DockedChat({ isLoggedIn }: { isLoggedIn: boolean }) {
  const { pinned } = useChatDock();

  if (!pinned) return null;

  return <LiveChat isLoggedIn={isLoggedIn} />;
}