import { NextRequest, NextResponse } from "next/server";
import { count, eq } from "drizzle-orm";
import { getAdminUser } from "@/lib/admin";
import { logAdminAction } from "@/lib/adminAudit";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

const ROLES = ["user", "admin"] as const;

/**
 * PATCH /api/admin/users/[id] { role }
 * Только выдача/снятие прав администратора. Банов и модераторов нет.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Нет прав" }, { status: 403 });
  }

  const { id } = await params;
  const targetId = Number(id);
  if (!Number.isInteger(targetId) || targetId <= 0) {
    return NextResponse.json({ error: "Некорректный id" }, { status: 400 });
  }

  const target = await db.select().from(users).where(eq(users.id, targetId)).get();
  if (!target) {
    return NextResponse.json({ error: "Игрок не найден" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const updates: Partial<typeof users.$inferInsert> = {};

  if (body?.role !== undefined) {
    if (!ROLES.includes(body.role)) {
      return NextResponse.json({ error: "Некорректная роль" }, { status: 400 });
    }
    if (target.id === admin.id && body.role !== "admin") {
      return NextResponse.json(
        { error: "Нельзя снять с себя права администратора" },
        { status: 400 }
      );
    }
    if (target.role === "admin" && body.role !== "admin") {
      const admins = await db
        .select({ total: count() })
        .from(users)
        .where(eq(users.role, "admin"))
        .get();
      if ((admins?.total ?? 0) <= 1) {
        return NextResponse.json(
          { error: "Нельзя оставить сайт без администраторов" },
          { status: 400 }
        );
      }
    }
    updates.role = body.role;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Нет изменений" }, { status: 400 });
  }

  await db.update(users).set(updates).where(eq(users.id, targetId)).run();
  await logAdminAction({
    admin,
    action: "user.role",
    targetType: "user",
    targetId,
    details: `${target.nickname}: ${target.role} → ${updates.role}`,
  });
  return NextResponse.json({ message: "OK" });
}
