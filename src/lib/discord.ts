/**
 * Отправка новых сообщений чата в Discord через вебхук.
 *
 * Направление «сайт/MC → Discord». Вызывается после сохранения сообщения
 * в chat_logs с source = "minecraft" | "website". Сообщения с source =
 * "discord" сюда не попадают (их принёс сам Discord — вебхук вернул бы их
 * обратно, получилось бы эхо).
 *
 * Постим как в популярных мостах (DiscordSRV и похожие): username вебхука —
 * ник игрока, avatar_url — голова игрока.
 *
 * Аватарка: mc-heads.net знает только официальные (Mojang) аккаунты, а на
 * нашем offline-сервере ники кастомные — Discord получал 404 и показывал
 * дефолтную аватарку вебхука. Плюс Discord качает avatar_url со своей
 * стороны, поэтому локальный сайт (Radmin VPN) ему недоступен. Поэтому
 * голову с нашего /api/chat/head/image загружаем на CDN Discord один раз
 * на игрока через сам вебхук (временное сообщение-загрузка сразу
 * удаляется) и дальше используем cdn.discordapp.com URL как avatar_url.
 *
 * Включение: DISCORD_WEBHOOK_URL в .env. Пока пусто — вебхук выключен,
 * функция ничего не делает.
 */

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || "";
const SITE_URL = (process.env.WEBSITE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");

/** Ник (lowercase) -> уже залитый на CDN Discord URL головы. */
const headUrlsByNick = new Map<string, string>();

/**
 * Возвращает публичный CDN-URL головы игрока, залитой на Discord один раз.
 * Сначала дергаем рендер головы с сайта (тот же процесс/сеть, Discord сюда
 * достучаться не может), потом грузим PNG через вебхук как вложение и
 * берём attachment.url из ответа. Временное сообщение удаляем — CDN-ссылка
 * продолжает работать. null, если у игрока нет скина или что-то упало.
 */
async function ensureHeadUrl(nickname: string): Promise<string | null> {
  const key = nickname.toLowerCase();
  const cached = headUrlsByNick.get(key);
  if (cached) return cached;

  const imgRes = await fetch(
    `${SITE_URL}/api/chat/head/image?nickname=${encodeURIComponent(nickname)}`
  ).catch(() => null);
  if (!imgRes || !imgRes.ok) return null;
  const buf = Buffer.from(await imgRes.arrayBuffer());

  const form = new FormData();
  form.append("content", "");
  form.append("file", new Blob([buf], { type: "image/png" }), `${key.replace(/[^a-z0-9_]/g, "_")}.png`);

  const res = await fetch(WEBHOOK_URL, { method: "POST", body: form }).catch(() => null);
  if (!res || !res.ok) return null;
  const data = (await res.json()) as { id?: string; attachments?: Array<{ url?: string }> };
  const url = data.attachments?.[0]?.url;
  if (!url) return null;
  if (data.id) {
    // Вложения удалённых сообщений продолжают жить на CDN.
    fetch(`${WEBHOOK_URL}/messages/${data.id}`, { method: "DELETE" }).catch(() => {});
  }
  headUrlsByNick.set(key, url);
  return url;
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
    payload.avatar_url = (await ensureHeadUrl(nickname)) ?? undefined;
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