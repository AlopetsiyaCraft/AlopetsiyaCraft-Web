import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { normalizeProfileLayout } from "@/lib/profileLayout";

/**
 * POST /api/profile/layout { layout: [{ id, visible, width }] }
 * Сохраняет порядок, видимость и ширину блоков вкладки «Обзор».
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ error: "Некорректная сессия" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const layout = normalizeProfileLayout(body?.layout);
  if (!layout) {
    return NextResponse.json({ error: "Некорректная раскладка" }, { status: 400 });
  }

  try {
    await db
      .update(users)
      .set({ profileLayout: JSON.stringify(layout) })
      .where(eq(users.id, userId))
      .run();
    return NextResponse.json({ layout });
  } catch (error) {
    console.error("Profile layout save error:", error);
    return NextResponse.json({ error: "Не удалось сохранить раскладку" }, { status: 500 });
  }
}
