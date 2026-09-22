import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { capeHistory, users } from "@/lib/db/schema";
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

    const capes = await db
      .select()
      .from(capeHistory)
      .where(eq(capeHistory.userId, user.id))
      .orderBy(desc(capeHistory.createdAt))
      .all();

    return NextResponse.json(capes);
  } catch (error) {
    console.error("Cape history error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
