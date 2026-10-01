/**
 * Объявления сайта в чат: запись в chat_logs, откуда сообщение забирает мод
 * chatbridge (GET /api/chat/from-server отдаёт всё с source != "minecraft"),
 * плюс сайт (GET /api/chat) и Discord.
 *
 * Ник "System" — служебный: в чате сайта у него своя аватарка
 * /avatars/system.png и нет ссылки на профиль (см. LiveChat), а в Discord
 * notifyDiscord постит его от имени «Системы» без аватарки.
 *
 * Ошибка доставки не должна ломать операцию, ради которой объявляем (например,
 * начисление валюты уже записано в базу) — поэтому исключения глотаются.
 */

import { db } from "@/lib/db";
import { chatLogs } from "@/lib/db/schema";
import { getActiveSeasonId } from "@/lib/bridge";
import { notifyDiscord } from "@/lib/discord";

const SYSTEM = "System";
const MAX_MESSAGE = 500;

/** Пишет служебное сообщение в чат. Молча переживает ошибку доставки. */
export async function announceToChat(message: string): Promise<void> {
  const text = message.trim().slice(0, MAX_MESSAGE);
  if (!text) return;

  try {
    const seasonId = await getActiveSeasonId();
    await db
      .insert(chatLogs)
      .values({ seasonId, nickname: SYSTEM, message: text, source: "website" })
      .run();
  } catch (error) {
    console.error("Chat announce failed:", error);
  }

  // Discord шлём даже при ошибке записи в базу — иначе рассинхрон.
  await notifyDiscord({ source: "website", nickname: SYSTEM, message: text }).catch(() => {});
}

/**
 * Объявление о начислении или списании валюты.
 *
 * @param currency     что именно начислили — для подписи в сообщении.
 * @param amount       изменение баланса: положительное — начисление,
 *                     отрицательное — списание. Ноль означает, что баланс уже
 *                     был на нуле и ничего не изменилось (такое бывает при
 *                     попытке списать больше, чем есть).
 */
export async function announceCurrencyChange({
  currency,
  amount,
  balance,
  targetNickname,
  adminNickname,
}: {
  currency: "BLD" | "фишки";
  amount: number;
  balance: number;
  targetNickname: string;
  adminNickname?: string | null;
}): Promise<void> {
  const verb = amount >= 0 ? "выдал" : "списал";
  const value = Math.abs(amount);
  const unit = currency === "BLD" ? "BLD" : "фишек";

  // Ноль списывать нечего — сообщение вводило бы в заблуждение.
  if (amount === 0) {
    await announceToChat(
      `${adminNickname ? `${adminNickname}: ` : ""}у игрока ${targetNickname} нечего ${amount >= 0 ? "выдавать" : "списать"} — баланс уже 0.`
    );
    return;
  }

  // Баланс пишем словом «текущий»: игрок мог уже потратить выданное, и число
  // рядом с суммой выдачи читалось бы как результат самой операции.
  const who = adminNickname ? `${adminNickname}: ` : "";
  await announceToChat(
    `${who}${verb} ${value} ${unit} игроку ${targetNickname}. Текущий баланс: ${balance} ${unit}.`
  );
}