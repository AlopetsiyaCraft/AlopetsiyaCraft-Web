import { eq } from "drizzle-orm";
import { db } from "./db";
import { notifications, users } from "./db/schema";

export interface NotificationInput {
  userId: number;
  type?: string;
  title: string;
  body?: string | null;
  link?: string | null;
}

/** Создать уведомление игроку. Не бросаем ошибку, если запись не удалась. */
export async function createNotification(input: NotificationInput): Promise<void> {
  try {
    await db
      .insert(notifications)
      .values({
        userId: input.userId,
        type: input.type ?? "system",
        title: input.title.slice(0, 160),
        body: input.body ? input.body.slice(0, 500) : null,
        link: input.link ? input.link.slice(0, 300) : null,
      })
      .run();
  } catch (error) {
    console.error("Notification insert error:", error);
  }
}

/** Уведомление по нику (если аккаунт существует). */
export async function createNotificationForNickname(
  nickname: string,
  input: Omit<NotificationInput, "userId">
): Promise<void> {
  const user = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.nickname, nickname))
    .get();
  if (!user) return;
  await createNotification({ userId: user.id, ...input });
}
