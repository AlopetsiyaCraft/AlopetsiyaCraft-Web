import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import Header from "@/components/Header";
import { db as dbAll } from "@/lib/db";
import { seasons } from "@/lib/db/schema";
import SettingsForm from "./SettingsForm";

export default async function SettingsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/auth/login");
  }

  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, parseInt(session.user.id)))
    .get();

  if (!user) {
    redirect("/auth/login");
  }

  const allSeasons = await dbAll.select().from(seasons).all();

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Header
        seasons={allSeasons}
        user={{ name: user.nickname, skinUrl: user.skinUrl }}
        isLoggedIn={true}
      />

      <div className="max-w-4xl mx-auto py-12 px-4">
        <div className="mb-6">
          <a href="/profile" className="text-[#7c3aed] hover:underline text-sm">
            ← Назад к профилю
          </a>
        </div>

        <h1 className="text-2xl font-bold mb-8">Настройки аккаунта</h1>

        <SettingsForm initialSkinUrl={user.skinUrl} initialCapeUrl={user.capeUrl} initialNickname={user.nickname} />
      </div>
    </div>
  );
}
