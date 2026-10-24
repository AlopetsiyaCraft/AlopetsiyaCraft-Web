import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getAdminUser } from "@/lib/admin";
import { logAdminAction } from "@/lib/adminAudit";
import { db } from "@/lib/db";
import { seasons } from "@/lib/db/schema";

/**
 * POST /api/admin/seasons — создать или обновить сезон.
 * { id?, number, name, description?, modpackUrl?, isActive? }
 * Если isActive=true, остальные сезоны автоматически становятся архивом.
 */
export async function POST(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Нет прав" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const id = body?.id != null ? Number(body.id) : null;
  const number = Number(body?.number);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description =
    typeof body?.description === "string" ? body.description.trim() : "";
  const modpackUrl =
    typeof body?.modpackUrl === "string" ? body.modpackUrl.trim() : "";
  const isActive = body?.isActive === true;

  if (!Number.isInteger(number) || number <= 0) {
    return NextResponse.json({ error: "Номер сезона должен быть целым > 0" }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "Название сезона обязательно" }, { status: 400 });
  }

  if (id != null) {
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Некорректный id" }, { status: 400 });
    }
    const existing = await db.select({ id: seasons.id }).from(seasons).where(eq(seasons.id, id)).get();
    if (!existing) {
      return NextResponse.json({ error: "Сезон не найден" }, { status: 404 });
    }
  }

  if (isActive) {
    await db.update(seasons).set({ isActive: false }).run();
  }

  try {
    if (id != null) {
      await db
        .update(seasons)
        .set({
          number,
          name,
          description: description || null,
          modpackUrl: modpackUrl || null,
          isActive,
        })
        .where(eq(seasons.id, id))
        .run();
      await logAdminAction({
        admin,
        action: "season.update",
        targetType: "season",
        targetId: id,
        details: `Сезон ${number}: ${name}${isActive ? " (активный)" : ""}`,
      });
      return NextResponse.json({ message: "Сезон сохранён", id });
    }

    const inserted = await db
      .insert(seasons)
      .values({
        number,
        name,
        description: description || null,
        modpackUrl: modpackUrl || null,
        isActive,
      })
      .run();
    const newId = Number(inserted.lastInsertRowid);
    await logAdminAction({
      admin,
      action: "season.create",
      targetType: "season",
      targetId: newId,
      details: `Сезон ${number}: ${name}`,
    });
    return NextResponse.json({ message: "Сезон создан", id: newId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("UNIQUE")) {
      return NextResponse.json({ error: "Сезон с таким номером уже есть" }, { status: 409 });
    }
    console.error("Admin season save error:", error);
    return NextResponse.json({ error: "Не удалось сохранить сезон" }, { status: 500 });
  }
}
