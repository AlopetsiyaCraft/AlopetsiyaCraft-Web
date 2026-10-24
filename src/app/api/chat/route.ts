import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chatLogs, chatReactions, users } from "@/lib/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getActiveSeasonId } from "@/lib/bridge";
import { notifyDiscord } from "@/lib/discord";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get("seasonId");
    const limit = Math.min(100, parseInt(searchParams.get("limit") || "50") || 50);
    const session = await auth();
    const viewerId = session?.user?.id ? parseInt(session.user.id, 10) : null;

    const baseQuery = db
      .select({
        id: chatLogs.id,
        nickname: chatLogs.nickname,
        message: chatLogs.message,
        source: chatLogs.source,
        createdAt: chatLogs.createdAt,
        replyToId: chatLogs.replyToId,
        skinUrl: users.skinUrl,
        nickColor: users.nickColor,
        frame: users.profileFrame,
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

    if (messages.length === 0) return NextResponse.json([]);

    const messageIds = messages.map((message) => message.id);
    const replyIds = [
      ...new Set(messages.map((message) => message.replyToId).filter((id): id is number => id != null)),
    ];

    const [replyRows, reactionRows] = await Promise.all([
      replyIds.length > 0
        ? db
            .select({
              id: chatLogs.id,
              nickname: chatLogs.nickname,
              message: chatLogs.message,
            })
            .from(chatLogs)
            .where(inArray(chatLogs.id, replyIds))
            .all()
        : Promise.resolve([]),
      db
        .select({
          messageId: chatReactions.messageId,
          emoji: chatReactions.emoji,
          userId: chatReactions.userId,
        })
        .from(chatReactions)
        .where(inArray(chatReactions.messageId, messageIds))
        .all(),
    ]);

    const replyById = new Map(replyRows.map((reply) => [reply.id, reply]));
    const reactionMap = new Map<number, Map<string, { count: number; mine: boolean }>>();
    for (const reaction of reactionRows) {
      let byEmoji = reactionMap.get(reaction.messageId);
      if (!byEmoji) {
        byEmoji = new Map();
        reactionMap.set(reaction.messageId, byEmoji);
      }
      const entry = byEmoji.get(reaction.emoji) ?? { count: 0, mine: false };
      entry.count += 1;
      if (viewerId != null && reaction.userId === viewerId) entry.mine = true;
      byEmoji.set(reaction.emoji, entry);
    }

    return NextResponse.json(
      messages.map((message) => {
        const parent = message.replyToId != null ? replyById.get(message.replyToId) : null;
        const byEmoji = reactionMap.get(message.id);
        return {
          ...message,
          replyTo: parent
            ? { id: parent.id, nickname: parent.nickname, message: parent.message.slice(0, 120) }
            : null,
          reactions: byEmoji
            ? [...byEmoji.entries()].map(([emoji, entry]) => ({ emoji, ...entry }))
            : [],
        };
      })
    );
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
    const { message, seasonId, replyToId } = body;

    if (!message || !message.trim()) {
      return NextResponse.json({ error: "Сообщение не может быть пустым" }, { status: 400 });
    }

    if (message.length > 500) {
      return NextResponse.json({ error: "Сообщение слишком длинное" }, { status: 400 });
    }

    let replyTarget: number | null = null;
    if (replyToId != null) {
      const parsed = Number(replyToId);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        return NextResponse.json({ error: "Некорректный ответ" }, { status: 400 });
      }
      const exists = await db
        .select({ id: chatLogs.id })
        .from(chatLogs)
        .where(eq(chatLogs.id, parsed))
        .get();
      if (!exists) {
        return NextResponse.json({ error: "Сообщение для ответа не найдено" }, { status: 404 });
      }
      replyTarget = parsed;
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
        replyToId: replyTarget,
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
