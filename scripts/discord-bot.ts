/**
 * Discord-бот чат-моста AlopetsiyaCraft.
 *
 * Направление «Discord → сайт/сервер Minecraft»: слушает сообщения в канале
 * и отправляет их на сайт в /api/chat/from-server с source="discord".
 * Дальше мод chatbridge подхватывает их поллингом и выводит в игру как
 * [Discord] <ник>: сообщение, а чат на сайте показывает их тоже.
 *
 * Запуск:
 *   npm run discord-bot
 *
 * Переменные окружения (.env):
 *   DISCORD_BOT_TOKEN  — токен бота (Discord Developer Portal)
 *   DISCORD_CHANNEL_ID — ID текстового канала для моста (если пусто — все каналы)
 *   WEBSITE_URL        — адрес сайта, по умолчанию http://127.0.0.1:3000
 *   CHAT_API_KEY       — должен совпадать с ключом на сайте
 *
 * Сообщения от самого бота и от вебхуков пропускаются (иначе сайт→Discord
 * вернулся бы обратно эхом через бота).
 */

import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  Events,
  Message,
  ActivityType,
} from "discord.js";

const TOKEN = process.env.DISCORD_BOT_TOKEN || "";
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID || "";
const WEBSITE_URL = (process.env.WEBSITE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
const API_KEY = process.env.CHAT_API_KEY || "";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

/** Недавно обработанные ID сообщений — защита от дублей при reconnect-реиграле гейтвея. */
const seenMessageIds = new Set<string>();
const SEEN_CAP = 500;

function markSeen(id: string): boolean {
  if (seenMessageIds.has(id)) return false;
  seenMessageIds.add(id);
  if (seenMessageIds.size > SEEN_CAP) {
    const first = seenMessageIds.values().next().value;
    if (first !== undefined) seenMessageIds.delete(first);
  }
  return true;
}

async function forwardToWebsite(message: Message): Promise<void> {
  if (!API_KEY) {
    console.error("CHAT_API_KEY не задан в .env — бот не может отправлять на сайт.");
    return;
  }

  const nickname =
    message.member?.displayName ??
    message.author.displayName ??
    message.author.username;

  const payload = {
    nickname: nickname.slice(0, 32),
    message: message.content.trim().slice(0, 500),
    source: "discord",
  };

  try {
    const res = await fetch(`${WEBSITE_URL}/api/chat/from-server`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error(`Сайт ответил ${res.status}: ${await res.text()}`);
    }
  } catch (error) {
    console.error("Ошибка отправки на сайт:", error);
  }
}

client.once(Events.ClientReady, (c) => {
  console.log(
    `Discord-бот ${c.user.tag} подключён${
      CHANNEL_ID ? `, канал: ${CHANNEL_ID}` : " (все каналы)"
    } → ${WEBSITE_URL}`
  );
  c.user.setActivity("чат AlopetsiyaCraft", { type: ActivityType.Watching });
});

client.on(Events.MessageCreate, async (message) => {
  // свои сообщения, вебхуки, других ботов и личные сообщения пропускаем
  if (message.author?.id === client.user?.id) return;
  if (message.webhookId) return;
  if (message.author?.bot) return;
  if (!message.guild || !message.channel) return;
  if (CHANNEL_ID && message.channel.id !== CHANNEL_ID) return;

  // дубли от reconnect-реиграла гейтвея пропускаем
  if (!markSeen(message.id)) return;

  const text = message.content?.trim() ?? "";
  if (!text) return;

  // не отвечаем на команды ботов вида /...
  if (text.startsWith("/")) return;

  await forwardToWebsite(message);
});

function shutdown(signal: string) {
  console.log(`Получен ${signal}, отключаюсь...`);
  client.destroy();
  process.exit(0);
}

async function main() {
  if (!TOKEN) {
    console.error(
      "DISCORD_BOT_TOKEN не задан в .env. Создайте приложение на " +
        "https://discord.com/developers/applications, добавьте бота в сервер " +
        "и укажите токен."
    );
    process.exit(1);
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  await client.login(TOKEN);
}

main().catch((error) => {
  console.error("Ошибка запуска бота:", error);
  process.exit(1);
});