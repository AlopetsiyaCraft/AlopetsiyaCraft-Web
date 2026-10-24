"use client";

import { usePathname } from "next/navigation";

/**
 * На телефоне шапка профиля (баннер, аватар, ник) показывается только на
 * «Обзоре» и «Стене». На остальных вкладках остаётся только навигация.
 * На десктопе шапка видна всегда.
 */
export default function ProfileHeaderGate({
  baseHref,
  children,
}: {
  baseHref: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const summary = pathname === baseHref || pathname === `${baseHref}/wall`;

  return <div className={summary ? undefined : "hidden lg:block"}>{children}</div>;
}
