import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getAdminUser } from "@/lib/admin";
import { logAdminAction } from "@/lib/adminAudit";
import { db } from "@/lib/db";
import { photos, wallPosts } from "@/lib/db/schema";

/**
 * PATCH /api/admin/content { type: "photo" | "post", id, caption?, visibility?, text? }
 * Редактирование контента без удаления: подписи, видимость фото и текст записей.
 */
export async function PATCH(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Нет прав" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const type = body?.type;
  const id = Number(body?.id);
  if (type !== "photo" && type !== "post") {
    return NextResponse.json({ error: "type: photo или post" }, { status: 400 });
  }
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Некорректный id" }, { status: 400 });
  }

  if (type === "photo") {
    const caption =
      typeof body?.caption === "string" ? body.caption.trim().slice(0, 300) : "";
    const visibility = body?.visibility === "registered" ? "registered" : "public";

    const updated = await db
      .update(photos)
      .set({ caption: caption || null, visibility })
      .where(eq(photos.id, id))
      .run();
    if (updated.rowsAffected === 0) {
      return NextResponse.json({ error: "Фото не найдено" }, { status: 404 });
    }
    await logAdminAction({
      admin,
      action: "content.photo",
      targetType: "photo",
      targetId: id,
      details: `подпись и видимость: ${visibility}`,
    });
    return NextResponse.json({ message: "Фото обновлено" });
  }

  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "Текст записи не может быть пустым" }, { status: 400 });
  }
  if (text.length > 2000) {
    return NextResponse.json({ error: "Текст длиннее 2000 символов" }, { status: 400 });
  }

  const updated = await db
    .update(wallPosts)
    .set({ text: text.slice(0, 2000) })
    .where(eq(wallPosts.id, id))
    .run();
  if (updated.rowsAffected === 0) {
    return NextResponse.json({ error: "Запись не найдена" }, { status: 404 });
  }
  await logAdminAction({
    admin,
    action: "content.post",
    targetType: "wall_post",
    targetId: id,
    details: "изменён текст записи",
  });
  return NextResponse.json({ message: "Запись обновлена" });
}
