/**
 * Отправка новых сообщений чата в Discord через вебхук.
 *
 * Направление «сайт/MC → Discord». Вызывается после сохранения сообщения
 * в chat_logs с source = "minecraft" | "website". Сообщения с source =
 * "discord" сюда не попадают (их принёс сам Discord — вебхук вернул бы их
 * обратно, получилось бы эхо).
 *
 * Включение: DISCORD_WEBHOOK_URL в .env. Пока пусто — вебхук выключен,
 * функция ничего не делает.
 */

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || "";

const SOURCE_LABEL: Record<string, string> = {
  minecraft: "Майнкрафт",
  website: "Сайт",
};

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

  const label = SOURCE_LABEL[source] ?? "Чат";
  // limit 2000 символов — лимит Discord
  const content = `**[${label}] ${nickname}:** ${message}`.slice(0, 2000);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    try {
      await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    console.error("Discord webhook error:", error);
  }
}