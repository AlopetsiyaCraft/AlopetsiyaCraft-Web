import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chatLogs, users } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getActiveSeasonId } from "@/lib/bridge";
import { notifyDiscord } from "@/lib/discord";

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
        source: chatLogs.source,
        createdAt: chatLogs.createdAt,
        skinUrl: users.skinUrl,
      })
      .from(chatLogs)
      .leftJoin(users, eq(chatLogs.nickname, users.nickname))
      .orderBy(desc(chatLogs.createdAt));

    const messages = (seasonId
      ? await baseQuery
          .where(eq(chatLogs.seasonId, parseInt(seasonId)))
          .limit(limit)
          .all()
      : await baseQuery.limit(limit).all()
    ).reverse();

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

    const requested = seasonId ? parseInt(String(seasonId), 10) : NaN;
    const activeSeasonId = Number.isFinite(requested) ? requested : await getActiveSeasonId();

    const result = await db
      .insert(chatLogs)
      .values({
        seasonId: activeSeasonId,
        nickname: session.user.name || "Unknown",
        message: message.trim(),
        source: "website",
      })
      .returning()
      .get();

    // Новое сообщение с сайта также уходит в Discord (если вебхук настроен).
    await notifyDiscord({
      source: "website",
      nickname: session.user.name || "Unknown",
      message: message.trim(),
    });

    return NextResponse.json({ message: "Отправлено", id: result.id }, { status: 201 });
  } catch (error) {
    console.error("Chat send error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
