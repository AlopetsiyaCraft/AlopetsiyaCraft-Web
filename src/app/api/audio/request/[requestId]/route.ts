import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { discRequests } from "@/lib/db/schema";

/**
 * GET /api/audio/request/[requestId] — статус заявки на пластинку.
 * Только для владельца заявки; UI поллит его, пока мод выдаёт пластинку.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);

  const { requestId } = await params;
  const id = parseInt(requestId, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Неверный id заявки" }, { status: 400 });
  }

  const row = await db
    .select({
      userId: discRequests.userId,
      status: discRequests.status,
      error: discRequests.error,
      trackId: discRequests.trackId,
    })
    .from(discRequests)
    .where(eq(discRequests.id, id))
    .limit(1)
    .get();

  if (!row) {
    return NextResponse.json({ error: "Заявка не найдена" }, { status: 404 });
  }

  if (row.userId !== userId) {
    return NextResponse.json({ error: "Чужая заявка" }, { status: 403 });
  }

  return NextResponse.json({ status: row.status, error: row.error, trackId: row.trackId });
}