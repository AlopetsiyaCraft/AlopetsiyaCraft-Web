import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";

/**
 * Проверка админа. Пока админ-панели нет, права даются по полю users.role:
 * role = "admin" (проставлено вручную аккаунту AlexMilash). Вернёт объект
 * игрока или null, если текущая сессия не админская.
 */
export async function getAdminUser(): Promise<{ id: number; nickname: string } | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const id = parseInt(session.user.id, 10);
  if (!Number.isFinite(id)) return null;
  const user = await db
    .select({ id: users.id, nickname: users.nickname, role: users.role })
    .from(users)
    .where(eq(users.id, id))
    .get();
  if (!user || user.role !== "admin") return null;
  return { id: user.id, nickname: user.nickname };
}