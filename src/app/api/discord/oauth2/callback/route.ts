import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

/**
 * Колбэк OAuth Discord. Обменивает code на access_token, берёт ID аккаунта
 * Discord (GET /users/@me), привязывает его к текущему пользователю сайта
 * и (по возможности) добавляет пользователя на сервер AlopetsiyaCraft —
 * со scope guilds.join и правом бота Create Instant Invite.
 *
 * Требует входа на сайт (session) и настроенных DISCORD_CLIENT_ID/SECRET
 * в .env. Redirect URI должен быть зарегистрирован в Developer Portal:
 *   <WEBSITE_URL>/api/discord/oauth2/callback
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code") ?? "";
  if (!code) {
    return NextResponse.redirect("/profile/settings?discord=error");
  }

  const clientId = process.env.DISCORD_CLIENT_ID || "";
  const clientSecret = process.env.DISCORD_CLIENT_SECRET || "";
  if (!clientId || !clientSecret) {
    return NextResponse.redirect("/profile/settings?discord=error");
  }

  const session = await auth();
  const userId = Number.parseInt(session?.user?.id ?? "", 10);
  if (!Number.isFinite(userId)) {
    // Не залогинен — отправим на логин; после входа пользователь снова
    // нажмёт «Привязать Discord».
    return NextResponse.redirect("/auth/login");
  }

  const base = (process.env.WEBSITE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
  const redirect = `${base}/api/discord/oauth2/callback`;

  // Обмен кода на токен.
  let tokenRes: Response;
  try {
    tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirect,
      }),
    });
  } catch {
    return NextResponse.redirect("/profile/settings?discord=error");
  }
  if (!tokenRes.ok) {
    const body = await tokenRes.text().catch(() => "");
    console.error("Discord token exchange failed:", tokenRes.status, body);
    return NextResponse.redirect("/profile/settings?discord=error");
  }
  const token = (await tokenRes.json()) as { access_token?: string };
  if (!token.access_token) {
    return NextResponse.redirect("/profile/settings?discord=error");
  }

  // Информация о Discord-аккаунте.
  const meRes = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!meRes.ok) {
    return NextResponse.redirect("/profile/settings?discord=error");
  }
  const me = (await meRes.json()) as { id: string };

  // Ник сайта, чтобы сразу поставить его при добавлении на сервер.
  const current = await db
    .select({ nickname: users.nickname })
    .from(users)
    .where(eq(users.id, userId))
    .get();

  // Добавление на сервер (best-effort): работает, если бот в этой гильдии,
  // у него есть право Create Instant Invite, а пользователь дал guilds.join.
  // Для уже состоящих в сервере возвращается 204 — сюда же можно передать
  // ник, который будет выставлен при добавлении.
  const guildId = process.env.DISCORD_GUILD_ID || "";
  if (guildId) {
    try {
      const joinBody: Record<string, string> = { access_token: token.access_token };
      if (current?.nickname) {
        joinBody.nick = current.nickname;
      }
      const joinRes = await fetch(`https://discord.com/api/guilds/${guildId}/members/${me.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN || ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(joinBody),
      });
      if (!joinRes.ok && joinRes.status !== 204 && joinRes.status !== 201) {
        const joinBodyText = await joinRes.text().catch(() => "");
        console.error("Discord guild join failed:", joinRes.status, joinBodyText);
      }
    } catch (joinError) {
      console.error("Discord guild join error:", joinError);
    }
  }

  // Снимаем привязку с другого аккаунта сайта, если была.
  await db.update(users).set({ discordId: null }).where(eq(users.discordId, me.id)).run();
  await db.update(users).set({ discordId: me.id }).where(eq(users.id, userId)).run();

  return NextResponse.redirect("/profile/settings?discord=linked");
}