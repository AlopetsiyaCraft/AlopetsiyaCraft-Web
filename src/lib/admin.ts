import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";

/**
 * Проверка админа. Права даются по полю users.role:
 * role = "admin". Вернёт объект игрока или null.
 */
export async function getAdminUser(): Promise<{ id: number; nickname: string } | null> {
  const staff = await getStaffUser();
  if (!staff || staff.role !== "admin") return null;
  return { id: staff.id, nickname: staff.nickname };
}

export type StaffRole = "moderator" | "admin";

/**
 * Админ или модератор. Модератору доступна только модерация контента;
 * управление пользователями и сезонами остаётся за админом.
 */
export async function getStaffUser(): Promise<{
  id: number;
  nickname: string;
  role: StaffRole;
} | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const id = parseInt(session.user.id, 10);
  if (!Number.isFinite(id)) return null;
  const user = await db
    .select({ id: users.id, nickname: users.nickname, role: users.role })
    .from(users)
    .where(eq(users.id, id))
    .get();
  if (!user || (user.role !== "admin" && user.role !== "moderator")) return null;
  return { id: user.id, nickname: user.nickname, role: user.role };
}
