import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users, nameHistory } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nickname, password } = body;

    if (!nickname || !password) {
      return NextResponse.json(
        { error: "Никнейм и пароль обязательны" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Пароль должен быть минимум 6 символов" },
        { status: 400 }
      );
    }

    const existingUser = db
      .select()
      .from(users)
      .where(eq(users.nickname, nickname))
      .get();

    if (existingUser) {
      return NextResponse.json(
        { error: "Этот никнейм уже занят" },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = db
      .insert(users)
      .values({
        nickname,
        passwordHash,
      })
      .returning()
      .get();

    db.insert(nameHistory)
      .values({
        userId: result.id,
        nickname,
      })
      .run();

    return NextResponse.json(
      { message: "Регистрация успешна", userId: result.id },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Ошибка сервера" },
      { status: 500 }
    );
  }
}
