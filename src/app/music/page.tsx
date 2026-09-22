import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * /music → /profile/<мой ник>/music; /music?user=<ник> → /profile/<ник>/music.
 * Сохраняет старые ссылки «Мои аудио» из шапки.
 */
export default async function MusicRedirect({
  searchParams,
}: {
  searchParams: Promise<{ user?: string }>;
}) {
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/auth/login?callbackUrl=${encodeURIComponent("/music")}`);
  }
  const me = await db
    .select({ name: users.nickname })
    .from(users)
    .where(eq(users.id, parseInt(session.user.id, 10)))
    .get();
  if (!me) redirect("/auth/login");

  const nick = typeof sp.user === "string" && sp.user.trim() ? sp.user.trim() : me.name;
  redirect(`/profile/${encodeURIComponent(nick)}/music`);
}