/**
 * Отправка новых сообщений чата в Discord через вебхук.
 *
 * Направление «сайт/MC → Discord». Вызывается после сохранения сообщения
 * в chat_logs с source = "minecraft" | "website". Сообщения с source =
 * "discord" сюда не попадают (их принёс сам Discord — вебхук вернул бы их
 * обратно, получилось бы эхо).
 *
 * Постим как в популярных мостах (DiscordSRV и похожие): username вебхука —
 * ник игрока, avatar_url — голова игрока с публичного рендера
 * (https://mc-heads.net/avatar/<ник>/128.png). Discord скачивает аватарку
 * со своих серверов, поэтому локальные адреса здесь не подходят.
 *
 * Включение: DISCORD_WEBHOOK_URL в .env. Пока пусто — вебхук выключен,
 * функция ничего не делает.
 */

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || "";

/** Публичный рендер головы игрока (аватарка в Discord). */
function headUrl(nickname: string): string {
  return `https://mc-heads.net/avatar/${encodeURIComponent(nickname)}/128.png`;
}

export async function notifyDiscord({
  source,
  nickname,
  message,
}: {
  source: string;
  nickname: string;
  message: string;
}): Promise<void> {
  if (!WEBHOOK_URL) return;

  // content: только само сообщение (ник и голова — через username/avatar_url).
  // Системные сообщения (заход/выход) постим от имени «Система» без аватарки.
  const isSystem = nickname === "System";
  const payload: {
    content: string;
    username: string;
    avatar_url?: string;
    allowed_mentions: { parse: [] };
  } = {
    content: message.slice(0, 2000),
    username: isSystem ? "Система" : nickname.slice(0, 32),
    allowed_mentions: { parse: [] },
  };
  if (!isSystem) {
    payload.avatar_url = headUrl(nickname);
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    try {
      await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    console.error("Discord webhook error:", error);
  }
}