import { NextRequest, NextResponse } from "next/server";

/**
 * Начало OAuth-потока Discord: редиректит на страницу авторизации Discord.
 * scope=identify — доступ к данным аккаунта, guilds.join — разрешение боту
 * добавить пользователя на сервер (если ещё не участник), поэтому в чекбокс
 * Discord попадёт и авторизация, и присоединение к серверу.
 *
 * redirect_uri строится от хоста, с которого открыт сайт (request.nextUrl.origin),
 * чтобы Discord вернулся на ТОТ ЖЕ хост, где у пользователя есть кука сессии
 * (localhost или 127.0.0.1 — оба должны быть зарегистрированы в
 * Developer Portal → OAuth2 → Redirects).
 *
 * Требует в .env: DISCORD_CLIENT_ID и DISCORD_CLIENT_SECRET.
 */
export async function GET(request: NextRequest) {
  const clientId = process.env.DISCORD_CLIENT_ID || "";
  const clientSecret = process.env.DISCORD_CLIENT_SECRET || "";
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "OAuth не настроен" }, { status: 503 });
  }
  const base = (process.env.WEBSITE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
  // origin строим из заголовка Host: server привязан к 0.0.0.0, поэтому
  // request.nextUrl.origin не отражает адрес, по которому зашёл пользователь.
  const host = request.headers.get("host") || new URL(base).host;
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "http";
  const origin = `${proto}://${host}`;
  const redirect = `${origin}/api/discord/oauth2/callback`;
  const url =
    `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(clientId)}` +
    `&response_type=code&redirect_uri=${encodeURIComponent(redirect)}` +
    `&scope=${encodeURIComponent("identify guilds.join")}`;
  return NextResponse.redirect(url);
}