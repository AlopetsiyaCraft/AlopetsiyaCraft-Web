import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Выбор модели персонажа: Стив (широкая) или Алекс (тонкая).
 *
 * POST /api/user/skin-model  { "model": "wide" | "slim" }
 *
 * Модель хранится в профиле и отдаётся моду AlopetsiyaSkinsAndCapes
 * через /api/chat/head вместе с скином и плащом. Определить её из PNG
 * 64x64 нельзя (слim-скин неотличим от широкого), поэтому игрок
 * переключает модель сам — иначе в игре его тонкий скин едет
 * под широкую модель Стива.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const model = body?.model;

    if (model !== "wide" && model !== "slim") {
      return NextResponse.json({ error: "Модель должна быть wide или slim" }, { status: 400 });
    }

    await db
      .update(users)
      .set({ skinModel: model })
      .where(eq(users.id, parseInt(session.user.id)))
      .run();

    return NextResponse.json({ message: "Модель обновлена", model });
  } catch (error) {
    console.error("Skin model error:", error);
    return NextResponse.json({ error: "Ошибка сохранения" }, { status: 500 });
  }
}
