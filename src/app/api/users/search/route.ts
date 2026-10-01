import { NextRequest, NextResponse } from "next/server";
import { and, like, ne } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { SYSTEM_NICKNAME } from "@/lib/chatSystem";

/** GET /api/users/search?q=<text> — поиск игроков по нику (авторизация). */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
  }
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json([]);
  }

  // Служебный профиль System в поиске не показываем — его нельзя добавить в
  // друзья и открыть как игрока.
  const rows = await db
    .select({ id: users.id, nickname: users.nickname, skinUrl: users.skinUrl })
    .from(users)
    .where(and(like(users.nickname, `%${q}%`), ne(users.nickname, SYSTEM_NICKNAME)))
    .limit(10)
    .all();

  return NextResponse.json(rows);
}