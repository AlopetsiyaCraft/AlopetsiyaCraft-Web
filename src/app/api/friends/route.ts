import { NextRequest, NextResponse } from "next/server";
import { eq, or } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { friends as friendsTable, users } from "@/lib/db/schema";
import type { FriendsResponse, FriendUser } from "@/lib/profile";

/** GET /api/friends — друзья, входящие и исходящие заявки текущего пользователя. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
  }
  const me = parseInt(session.user.id, 10);

  const rows = await db
    .select({
      id: friendsTable.id,
      userId: friendsTable.userId,
      friendId: friendsTable.friendId,
      status: friendsTable.status,
      requesterId: friendsTable.requesterId,
      createdAt: friendsTable.createdAt,
      aNickname: users.nickname,
      aSkinUrl: users.skinUrl,
      aId: users.id,
    })
    .from(friendsTable)
    .leftJoin(users, eq(friendsTable.userId, users.id))
    .where(or(eq(friendsTable.userId, me), eq(friendsTable.friendId, me)))
    .orderBy(friendsTable.createdAt)
    .all();

  // Подтягиваем второй ник/скин отдельным запросом (нет удобного второго join).
  const otherIds = rows.map((r) => (r.userId === me ? r.friendId : r.userId));
  const otherRows = otherIds.length
    ? await db
        .select({ id: users.id, nickname: users.nickname, skinUrl: users.skinUrl })
        .from(users)
        .where(or(...otherIds.map((id) => eq(users.id, id))))
        .all()
    : [];
  const byId = new Map(otherRows.map((u) => [u.id, u]));

  const accepted: FriendsResponse["accepted"] = [];
  const incoming: FriendsResponse["incoming"] = [];
  const outgoing: FriendsResponse["outgoing"] = [];

  for (const r of rows) {
    const otherId = r.userId === me ? r.friendId : r.userId;
    const other = byId.get(otherId);
    if (!other) continue;
    const base: FriendUser = { id: other.id, nickname: other.nickname, skinUrl: other.skinUrl };
    const since = r.createdAt.getTime();
    if (r.status === "accepted") {
      accepted.push({ ...base, since });
    } else if (r.requesterId === me) {
      outgoing.push({ ...base, since });
    } else {
      incoming.push({ ...base, since });
    }
  }

  return NextResponse.json({ accepted, incoming, outgoing } satisfies FriendsResponse);
}