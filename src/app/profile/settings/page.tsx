import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import Header from "@/components/Header";
import { db as dbAll } from "@/lib/db";
import { seasons } from "@/lib/db/schema";
import SettingsForm from "./SettingsForm";
import DiscordLinkCard from "./DiscordLinkCard";

function siteOrigin(): string {
  return (process.env.WEBSITE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
}

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

  // OAuth-кнопка «Подключить через Discord» доступна, если заданы
  // DISCORD_CLIENT_ID и DISCORD_CLIENT_SECRET в .env.
  const clientId = process.env.DISCORD_CLIENT_ID || "";
  const hasOAuth = !!clientId && !!process.env.DISCORD_CLIENT_SECRET;
  const oauthUrl = hasOAuth
    ? `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(
        clientId
      )}&response_type=code&redirect_uri=${encodeURIComponent(
        `${siteOrigin()}/api/discord/oauth2/callback`
      )}&scope=identify`
    : null;

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

        {params.discord === "linked" && (
          <div className="mb-6 bg-green-900/30 border border-green-700 text-green-300 rounded-lg p-4 text-sm">
            Discord привязан! Бот обновит твой ник и аватарку на сервере.
          </div>
        )}
        {params.discord === "error" && (
          <div className="mb-6 bg-red-900/30 border border-red-700 text-red-300 rounded-lg p-4 text-sm">
            Не удалось подключить Discord через OAuth. Попробуй ещё раз или
            привяжи аккаунт вручную по Discord ID.
          </div>
        )}

        <SettingsForm initialSkinUrl={user.skinUrl} initialCapeUrl={user.capeUrl} initialNickname={user.nickname} />

        <div className="mt-6">
          <DiscordLinkCard discordId={user.discordId} oauthUrl={oauthUrl} />
        </div>
      </div>
    </div>
  );
}