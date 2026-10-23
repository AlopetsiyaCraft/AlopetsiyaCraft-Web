import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { seasons, users } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import Header from "@/components/Header";
import { parseProfileLayout } from "@/lib/profileLayout";
import ProfileLayoutForm from "../ProfileLayoutForm";

/** /profile/settings/layout — порядок, ширина и видимость блоков обзора. */
export default async function ProfileLayoutSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/login?callbackUrl=/profile/settings/layout");
  }

  const userId = parseInt(session.user.id, 10);
  const [user, allSeasons] = await Promise.all([
    db.select().from(users).where(eq(users.id, userId)).get(),
    db.select().from(seasons).orderBy(desc(seasons.number)).all(),
  ]);
  if (!user) redirect("/auth/login");

  const layout = parseProfileLayout(user.profileLayout);

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Header
        seasons={allSeasons}
        user={{ name: user.nickname, skinUrl: user.skinUrl, bld: user.bld }}
        isLoggedIn
      />

      <div className="mx-auto w-full max-w-4xl px-4 py-12">
        <div className="mb-6">
          <Link
            href="/profile/settings"
            className="text-sm text-[var(--mc-green)] hover:underline"
          >
            ← Назад к настройкам
          </Link>
        </div>

        <h1 className="mc-title text-2xl">Блоки профиля</h1>
        <p className="mb-6 mt-1 text-sm text-[var(--text-secondary)]">
          Порядок, ширина и видимость блоков на вкладке «Обзор». Настройка
          применяется сразу для всех, кто открывает твой профиль.
        </p>

        <ProfileLayoutForm initialLayout={layout} />
      </div>
    </div>
  );
}

export const metadata = {
  title: "Блоки профиля",
};
