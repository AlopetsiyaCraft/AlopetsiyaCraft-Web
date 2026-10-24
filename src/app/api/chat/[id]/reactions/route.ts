import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { chatLogs, chatReactions } from "@/lib/db/schema";

/** Разрешённые эмодзи: набор фиксирован, чтобы не хранить произвольный текст. */
const CHAT_EMOJIS = ["👍", "❤️", "🔥", "😂"] as const;

/**
 * POST /api/chat/[id]/reactions { emoji }
 * Ставит или снимает реакцию текущего игрока.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ error: "Некорректная сессия" }, { status: 401 });
  }

  const { id } = await params;
  const messageId = Number(id);
  if (!Number.isInteger(messageId) || messageId <= 0) {
    return NextResponse.json({ error: "Некорректное сообщение" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const emoji = typeof body?.emoji === "string" ? body.emoji : "";
  if (!CHAT_EMOJIS.includes(emoji as (typeof CHAT_EMOJIS)[number])) {
    return NextResponse.json({ error: "Недопустимая реакция" }, { status: 400 });
  }

  const message = await db
    .select({ id: chatLogs.id })
    .from(chatLogs)
    .where(eq(chatLogs.id, messageId))
    .get();
  if (!message) {
    return NextResponse.json({ error: "Сообщение не найдено" }, { status: 404 });
  }

  const existing = await db
    .select({ id: chatReactions.id })
    .from(chatReactions)
    .where(
      and(
        eq(chatReactions.messageId, messageId),
        eq(chatReactions.userId, userId),
        eq(chatReactions.emoji, emoji)
      )
    )
    .get();

  if (existing) {
    await db.delete(chatReactions).where(eq(chatReactions.id, existing.id)).run();
  } else {
    await db
      .insert(chatReactions)
      .values({ messageId, userId, emoji })
      .onConflictDoNothing()
      .run();
  }

  const rows = await db
    .select({ emoji: chatReactions.emoji, userId: chatReactions.userId })
    .from(chatReactions)
    .where(eq(chatReactions.messageId, messageId))
    .all();

  const counts = new Map<string, { count: number; mine: boolean }>();
  for (const row of rows) {
    const entry = counts.get(row.emoji) ?? { count: 0, mine: false };
    entry.count += 1;
    if (row.userId === userId) entry.mine = true;
    counts.set(row.emoji, entry);
  }

  return NextResponse.json({
    messageId,
    toggled: emoji,
    active: !existing,
    reactions: [...counts.entries()].map(([value, entry]) => ({ emoji: value, ...entry })),
  });
}
