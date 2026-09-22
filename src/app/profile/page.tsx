import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * /profile → /profile/<мой ник>; /profile?user=<ник> → /profile/<ник>.
 * Так старые ссылки (?user=) продолжают работать после перехода на osu-адреса.
 */
export default async function ProfileRedirect({
  searchParams,
}: {
  searchParams: Promise<{ user?: string }>;
}) {
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/auth/login?callbackUrl=${encodeURIComponent("/profile")}`);
  }
  const me = await db
    .select({ name: users.nickname })
    .from(users)
    .where(eq(users.id, parseInt(session.user.id, 10)))
    .get();
  if (!me) redirect("/auth/login");

  const nick = typeof sp.user === "string" && sp.user.trim() ? sp.user.trim() : me.name;
  redirect(`/profile/${encodeURIComponent(nick)}`);
}