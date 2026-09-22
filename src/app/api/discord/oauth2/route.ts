import { NextResponse } from "next/server";

/**
 * Начало OAuth-потока Discord: редиректит на страницу авторизации Discord.
 * scope=identify — доступ к данным аккаунта, guilds.join — разрешение боту
 * добавить пользователя на сервер (по желанию, если ещё не участник),
 * поэтому в чекбокс Discord попадёт и авторизация, и присоединение к серверу.
 *
 * Требует в .env: DISCORD_CLIENT_ID и DISCORD_CLIENT_SECRET.
 * В Developer Portal Discord у приложения (OAuth2 → General → Redirects)
 * должен быть зарегистрирован redirect URI:
 *   <WEBSITE_URL>/api/discord/oauth2/callback
 */
export async function GET() {
  const clientId = process.env.DISCORD_CLIENT_ID || "";
  const clientSecret = process.env.DISCORD_CLIENT_SECRET || "";
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "OAuth не настроен" }, { status: 503 });
  }
  const base = (process.env.WEBSITE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
  const redirect = `${base}/api/discord/oauth2/callback`;
  const url =
    `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(clientId)}` +
    `&response_type=code&redirect_uri=${encodeURIComponent(redirect)}` +
    `&scope=${encodeURIComponent("identify guilds.join")}`;
  return NextResponse.redirect(url);
}