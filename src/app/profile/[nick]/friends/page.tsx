import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import FriendsTab from "@/components/FriendsTab";

/** Вкладка «Друзья»: список друзей, заявки, поиск и приглашения. */
export default async function ProfileFriendsPage({
  params,
}: {
  params: Promise<{ nick: string }>;
}) {
  const { nick } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/auth/login?callbackUrl=${encodeURIComponent(`/profile/${encodeURIComponent(nick)}/friends`)}`);
  }
  const me = await db
    .select({ id: users.id, name: users.nickname })
    .from(users)
    .where(eq(users.id, parseInt(session.user.id, 10)))
    .get();
  if (!me) redirect("/auth/login");

  return <FriendsTab viewerNickname={me.name} />;
}