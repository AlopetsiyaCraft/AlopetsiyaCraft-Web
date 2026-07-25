import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { comments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }

    const body = await request.json();
    const { screenshotId, parentId, text } = body;

    if (!screenshotId || !text) {
      return NextResponse.json(
        { error: "ID скриншота и текст обязательны" },
        { status: 400 }
      );
    }

    const result = db
      .insert(comments)
      .values({
        screenshotId,
        userId: parseInt(session.user.id),
        parentId: parentId || null,
        text,
      })
      .returning()
      .get();

    return NextResponse.json(
      { message: "Комментарий добавлен", id: result.id },
      { status: 201 }
    );
  } catch (error) {
    console.error("Comment error:", error);
    return NextResponse.json(
      { error: "Ошибка сервера" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const screenshotId = searchParams.get("screenshotId");

    if (!screenshotId) {
      return NextResponse.json(
        { error: "ID скриншота обязателен" },
        { status: 400 }
      );
    }

    const screenshotComments = db
      .select()
      .from(comments)
      .where(eq(comments.screenshotId, parseInt(screenshotId)))
      .all();

    return NextResponse.json(screenshotComments);
  } catch (error) {
    console.error("Comments fetch error:", error);
    return NextResponse.json(
      { error: "Ошибка сервера" },
      { status: 500 }
    );
  }
}
