/**
 * Discord-бот чат-моста AlopetsiyaCraft.
 *
 * Направление «Discord → сайт/сервер Minecraft»: слушает сообщения в канале
 * и отправляет их на сайт в /api/chat/from-server с source="discord".
 * Дальше мод chatbridge подхватывает их поллингом и выводит в игру как
 * [Discord] <ник>: сообщение, а чат на сайте показывает их тоже.
 * Если Discord-аккаунт автора привязан к профилю сайта, сайт сам подставит
 * НИК САЙТА (а не ник Discord) — в MC-чате будет единый игровой ник с головой.
 *
 * Синхронизация профилей: бот ставит привязанным участникам сервера ник
 * с сайта и аватарку-голову с их скина (server avatar). Обновляется при
 * сообщении участника, при входе, при смене ника и разово при запуске.
 * Нужно: право «Управление никами» (Manage Nicknames) у бота на сервере;
 * для событий входа/смены ника дополнительно Privileged Intent «Server
 * Members» в Developer Portal бота (без него синхронизация по сообщению
 * всё равно работает).
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
  GuildMember,
  Routes,
} from "discord.js";

const TOKEN = process.env.DISCORD_BOT_TOKEN || "";
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID || "";
// Если задан — синхронизировать ники/аватарки и слушать сообщения только на этом сервере.
const GUILD_ID = process.env.DISCORD_GUILD_ID || "";
const WEBSITE_URL = (process.env.WEBSITE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
const API_KEY = process.env.CHAT_API_KEY || "";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    // Нужен, чтобы видеть участников сервера (вход/смена ника).
    // Включается как Privileged Intent на странице бота в Discord Developer Portal.
    GatewayIntentBits.GuildMembers,
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
    discordUserId: message.author.id,
  };

  console.log(`[Discord→site] authorId=${message.author.id} nick="${nickname}": ${payload.message.slice(0, 60)}`);

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

/** Последняя установленная аватарка (URL головы) по ID участника — чтобы не дёргать API зря. */
const lastAvatarByMember = new Map<string, string>();

/**
 * Синхронизация профиля участника Discord-сервера с профилем сайта:
 *  - ник участника = ник сайта (setNickname);
 *  - аватарка участника на сервере = голова скина сайта (server avatar).
 * Резолвим Discord ID через GET /api/discord; если аккаунт не привязан —
 * ничего не трогаем. Требует у бота права «Управление никами» (Manage Nicknames).
 * Ник/аватарка участников Discord-сервера — per-server, как и задумано:
 * на разных серверах можно держать разные ники и аватарки.
 */
async function syncProfile(member: GuildMember): Promise<void> {
  if (member.user.bot) return;
  if (GUILD_ID && member.guild.id !== GUILD_ID) return;
  if (!API_KEY) return;
  try {
    const res = await fetch(
      `${WEBSITE_URL}/api/discord?discordId=${encodeURIComponent(member.id)}`,
      { headers: { "x-api-key": API_KEY } }
    );
    if (res.status === 404) return; // не привязан — ник/аватарку не трогаем
    if (!res.ok) {
      console.error(`Сайт ответил ${res.status} на /api/discord`);
      return;
    }
    const data = (await res.json()) as { nickname?: string };
    if (!data.nickname) return;

    // Ник на сервере = ник сайта. Отдельный try — даже если ник сменить нельзя
    // (например, участник — владелец сервера), аватарку всё равно ставим.
    try {
      if (member.nickname !== data.nickname) {
        await member.setNickname(data.nickname);
        console.log(`Discord: ник участника ${member.user.tag} → ${data.nickname}`);
      }
    } catch (nickError) {
      console.error(`Discord: не удалось сменить ник ${member.user.tag}:`, nickError);
    }

    // Аватарка на сервере = голова скина с сайта.
    try {
      const avatarUrl = `${WEBSITE_URL}/api/chat/head/image?nickname=${encodeURIComponent(data.nickname)}`;
      if (lastAvatarByMember.get(member.id) !== avatarUrl) {
        const imgRes = await fetch(avatarUrl);
        if (imgRes.ok) {
          const buf = Buffer.from(await imgRes.arrayBuffer());
          const dataUri = `data:image/png;base64,${buf.toString("base64")}`;
          await client.rest.patch(Routes.guildMember(member.guild.id, member.id), {
            body: { avatar: dataUri },
          });
          lastAvatarByMember.set(member.id, avatarUrl);
          console.log(`Discord: аватарка участника ${member.user.tag} → голова сайта`);
        } else {
          console.error(`Сайт ответил ${imgRes.status} на ${avatarUrl}`);
        }
      }
    } catch (avatarError) {
      console.error(
        `Discord: не удалось поставить аватарку ${member.user.tag} ` +
          `(нужно право Manage Nicknames у бота):`,
        avatarError
      );
    }
  } catch (error) {
    console.error(
      `Discord: не удалось синхронизировать ${member.user.tag} (запрос к сайту):`,
      error
    );
  }
}

client.once(Events.ClientReady, async (c) => {
  console.log(
    `Discord-бот ${c.user.tag} подключён${
      CHANNEL_ID ? `, канал: ${CHANNEL_ID}` : " (все каналы)"
    } → ${WEBSITE_URL}`
  );
  await c.user.setActivity("чат AlopetsiyaCraft", { type: ActivityType.Watching });

  // разовая синхронизация ников/аватарок уже сидящих участников (после рестарта бота)
  for (const guild of c.guilds.cache.values()) {
    if (GUILD_ID && guild.id !== GUILD_ID) continue;
    try {
      const members = await guild.members.fetch();
      for (const member of members.values()) {
        await syncProfile(member);
      }
    } catch (error) {
      console.error(
        `Discord: не смог получить участников сервера «${guild.name}»:`,
        error
      );
    }
  }
});

client.on(Events.MessageCreate, async (message) => {
  // свои сообщения, вебхуки, других ботов и личные сообщения пропускаем
  if (message.author?.id === client.user?.id) return;
  if (message.webhookId) return;
  if (message.author?.bot) return;
  if (!message.guild || !message.channel) return;
  if (GUILD_ID && message.guild.id !== GUILD_ID) return;
  if (CHANNEL_ID && message.channel.id !== CHANNEL_ID) return;

  // дубли от reconnect-реиграла гейтвея пропускаем
  if (!markSeen(message.id)) return;

  const text = message.content?.trim() ?? "";
  if (!text) return;

  // не отвечаем на команды ботов вида /...
  if (text.startsWith("/")) return;

  await forwardToWebsite(message);

  // Заодно синхронизируем ник и аватарку автора (если аккаунт привязан).
  // Срабатывает на сообщении, поэтому работает и без privileged-интента
  // Server Members.
  if (message.member) {
    void syncProfile(message.member);
  }
});

// Ник и аватарка участника = профиль сайта: обновляем при входе на сервер
// и при смене ника (событие придёт и после нашего собственного изменения,
// но там ники/аватарки уже совпадут — повторного действия нет).
client.on(Events.GuildMemberAdd, (member) => {
  void syncProfile(member);
});
client.on(Events.GuildMemberUpdate, (_oldMember, member) => {
  void syncProfile(member);
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