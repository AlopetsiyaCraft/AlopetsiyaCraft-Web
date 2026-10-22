import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import Header from "@/components/Header";
import { db as dbAll } from "@/lib/db";
import { seasons } from "@/lib/db/schema";
import SettingsForm from "./SettingsForm";
import DiscordLinkCard from "./DiscordLinkCard";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ discord?: string }>;
}) {
  const params = await searchParams;
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

  // OAuth-кнопка «Привязать Discord» доступна, если заданы
  // DISCORD_CLIENT_ID и DISCORD_CLIENT_SECRET в .env. Сама ссылка — на
  // роут /api/discord/oauth2: он строит полный URL авторизации Discord
  // (scope=identify guilds.join) и редиректит на него.
  const clientId = process.env.DISCORD_CLIENT_ID || "";
  const hasOAuth = !!clientId && !!process.env.DISCORD_CLIENT_SECRET;
  const oauthUrl = hasOAuth ? "/api/discord/oauth2" : null;

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Header
        seasons={allSeasons}
        user={{ name: user.nickname, skinUrl: user.skinUrl, bld: user.bld }}
        isLoggedIn={true}
      />

      <div className="max-w-4xl mx-auto py-12 px-4">
        <div className="mb-6">
          <Link href="/profile" className="text-[var(--mc-green)] hover:underline text-sm">
            ← Назад к профилю
          </Link>
        </div>

        <h1 className="mc-title text-2xl mb-8">Настройки аккаунта</h1>

        {params.discord === "linked" && (
          <div className="mc-inset mb-6 border-[var(--mc-green)] text-[var(--mc-green-light)] p-4 text-sm">
            Discord привязан! Бот обновит твой ник и аватарку на сервере и
            добавит тебя на сервер AlopetsiyaCraft, если тебя там ещё нет.
          </div>
        )}
        {params.discord === "error" && (
          <div className="mc-inset mb-6 border-[var(--mc-red)] text-[var(--mc-red)] p-4 text-sm">
            Не удалось подключить Discord. Проверь, что ты авторизовал
            приложение, и попробуй ещё раз.
          </div>
        )}

        <SettingsForm
          initialSkinUrl={user.skinUrl}
          initialCapeUrl={user.capeUrl}
          initialNickname={user.nickname}
          initialSkinModel={user.skinModel}
        />

        <div className="mt-6">
          <DiscordLinkCard discordId={user.discordId} oauthUrl={oauthUrl} />
        </div>
      </div>
    </div>
  );
}