import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, playersOnline } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  try {
    const SITE_ONLINE_THRESHOLD_MS = 30 * 1000;
    const now = new Date();

    const allUsers = await db
      .select({
        id: users.id,
        nickname: users.nickname,
        skinUrl: users.skinUrl,
        lastActiveAt: users.lastActiveAt,
      })
      .from(users)
      .orderBy(desc(users.lastActiveAt))
      .all();

    const serverOnline = await db.select().from(playersOnline).all();
    const serverOnlineNicknames = new Set(serverOnline.map((p) => p.nickname));

    const players = allUsers.map((user) => {
      const isServerOnline = serverOnlineNicknames.has(user.nickname);
      // drizzle converts NULL to epoch-0 Date (1970); treat it as "never active"
      const lastActiveMs = user.lastActiveAt instanceof Date ? user.lastActiveAt.getTime() : 0;
      const isSiteOnline =
        !isServerOnline &&
        lastActiveMs > 0 &&
        now.getTime() - lastActiveMs < SITE_ONLINE_THRESHOLD_MS;

      return {
        ...user,
        lastActiveAt: lastActiveMs > 0 ? user.lastActiveAt : null,
        status: isServerOnline ? "server" : isSiteOnline ? "site" : "offline",
      };
    });

    return NextResponse.json(players);
  } catch (error) {
    console.error("Players fetch error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
