import { NextRequest, NextResponse } from "next/server";
import { count, eq } from "drizzle-orm";
import { getAdminUser } from "@/lib/admin";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

const ROLES = ["user", "moderator", "admin"] as const;

/**
 * PATCH /api/admin/users/[id] { role?, banned?, banReason? }
 * Роль, бан и разбан. Нельзя снять с себя админа и оставить сайт без админов.
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

  if (typeof body?.banned === "boolean") {
    if (target.id === admin.id && body.banned) {
      return NextResponse.json({ error: "Нельзя забанить самого себя" }, { status: 400 });
    }
    updates.bannedAt = body.banned ? new Date() : null;
    updates.banReason =
      body.banned && typeof body.banReason === "string"
        ? body.banReason.trim().slice(0, 300) || null
        : null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Нет изменений" }, { status: 400 });
  }

  await db.update(users).set(updates).where(eq(users.id, targetId)).run();
  return NextResponse.json({ message: "OK" });
}
