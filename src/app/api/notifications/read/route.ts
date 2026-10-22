import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";

/**
 * POST /api/notifications/read { all?: boolean, ids?: number[] }
 * Отметить уведомления прочитанными. Без ids и без all — ошибка.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);

  const body = await request.json().catch(() => null);
  const all = body?.all === true;
  const ids = Array.isArray(body?.ids)
    ? body.ids
        .map((id: unknown) => Number(id))
        .filter((id: number) => Number.isInteger(id) && id > 0)
    : [];

  if (!all && ids.length === 0) {
    return NextResponse.json({ error: "Укажи ids или all: true" }, { status: 400 });
  }

  const where = all
    ? and(eq(notifications.userId, userId), isNull(notifications.readAt))
    : and(
        eq(notifications.userId, userId),
        isNull(notifications.readAt),
        inArray(notifications.id, ids)
      );

  await db.update(notifications).set({ readAt: new Date() }).where(where).run();
  return NextResponse.json({ message: "OK" });
}
