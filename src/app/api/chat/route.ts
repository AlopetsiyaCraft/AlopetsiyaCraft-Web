import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chatLogs, users } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get("seasonId");
    const limit = parseInt(searchParams.get("limit") || "50");

    const baseQuery = db
      .select({
        id: chatLogs.id,
        nickname: chatLogs.nickname,
        message: chatLogs.message,
        createdAt: chatLogs.createdAt,
        skinUrl: users.skinUrl,
      })
      .from(chatLogs)
      .leftJoin(users, eq(chatLogs.nickname, users.nickname))
      .orderBy(asc(chatLogs.createdAt));

    const messages = seasonId
      ? await baseQuery
          .where(eq(chatLogs.seasonId, parseInt(seasonId)))
          .limit(limit)
          .all()
      : await baseQuery.limit(limit).all();

    return NextResponse.json(messages);
  } catch (error) {
    console.error("Chat fetch error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }

    const body = await request.json();
    const { message, seasonId } = body;

    if (!message || !message.trim()) {
      return NextResponse.json({ error: "Сообщение не может быть пустым" }, { status: 400 });
    }

    if (message.length > 500) {
      return NextResponse.json({ error: "Сообщение слишком длинное" }, { status: 400 });
    }

    const activeSeasonId = seasonId || 4;

    const result = await db
      .insert(chatLogs)
      .values({
        seasonId: activeSeasonId,
        nickname: session.user.name || "Unknown",
        message: message.trim(),
      })
      .returning()
      .get();

    return NextResponse.json({ message: "Отправлено", id: result.id }, { status: 201 });
  } catch (error) {
    console.error("Chat send error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
