import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, nameHistory, playerStats, playerInventories, mcSessions } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }

    const body = await request.json();
    const { nickname } = body;

    if (!nickname || !nickname.trim()) {
      return NextResponse.json({ error: "Никнейм обязателен" }, { status: 400 });
    }

    const trimmed = nickname.trim();

    if (trimmed.length < 3 || trimmed.length > 16) {
      return NextResponse.json(
        { error: "Никнейм должен быть от 3 до 16 символов" },
        { status: 400 }
      );
    }

    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      return NextResponse.json(
        { error: "Никнейм может содержать только буквы, цифры и подчёркивание" },
        { status: 400 }
      );
    }

    const userId = parseInt(session.user.id);

    const currentUser = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .get();

    if (!currentUser) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    if (currentUser.nickname.toLowerCase() === trimmed.toLowerCase()) {
      return NextResponse.json({ error: "Это уже ваш никнейм" }, { status: 400 });
    }

    // Проверяем занятость без учёта регистра — в игре ники регистронезависимы.
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.nickname}) = ${trimmed.toLowerCase()}`)
      .get();

    if (existing && existing.id !== userId) {
      return NextResponse.json(
        { error: "Этот никнейм уже занят" },
        { status: 400 }
      );
    }

    const oldNickname = currentUser.nickname;

    await db
      .update(users)
      .set({ nickname: trimmed })
      .where(eq(users.id, userId))
      .run();

    await db
      .insert(nameHistory)
      .values({
        userId,
        nickname: trimmed,
      })
      .run();

    // Переносим весь прогресс аккаунта на новый ник:
    // - статистику с сервера (лидерборд, профиль);
    // - активную сессию входа на MC-сервер НЕ переносим: смена ника для нас —
    //   «новое лицо», игрок должен заново ввести пароль /login под новым ником.
    await db
      .update(playerStats)
      .set({ nickname: trimmed })
      .where(sql`lower(${playerStats.nickname}) = ${oldNickname.toLowerCase()}`)
      .run();

    // Снимок инвентаря тоже ключуется по нику — переносим его на новый ник,
    // чтобы новая страница /inventory не оказалась пустой.
    await db
      .update(playerInventories)
      .set({ nickname: trimmed.toLowerCase(), displayNickname: trimmed })
      .where(sql`lower(${playerInventories.nickname}) = ${oldNickname.toLowerCase()}`)
      .run();

    await db.delete(mcSessions).where(eq(mcSessions.userId, userId)).run();

    return NextResponse.json({ message: "Никнейм обновлён", nickname: trimmed });
  } catch (error) {
    console.error("Name change error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
