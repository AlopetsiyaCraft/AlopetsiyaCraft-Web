import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { skinHistory, users } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const nickname = searchParams.get("user");

    if (!nickname) {
      return NextResponse.json({ error: "User required" }, { status: 400 });
    }

    const user = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.nickname, nickname))
      .get();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const skins = await db
      .select()
      .from(skinHistory)
      .where(eq(skinHistory.userId, user.id))
      .orderBy(desc(skinHistory.createdAt))
      .all();

    return NextResponse.json(skins);
  } catch (error) {
    console.error("Skin history error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
