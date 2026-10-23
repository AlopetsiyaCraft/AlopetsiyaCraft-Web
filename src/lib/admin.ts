import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";

/**
 * Проверка админа. Права даются по полю users.role = "admin".
 * Модераторов и банов на сервере для своих нет — только владелец.
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
