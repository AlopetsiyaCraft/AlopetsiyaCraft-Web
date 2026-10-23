import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getAdminUser } from "@/lib/admin";
import { db } from "@/lib/db";
import { shopProducts } from "@/lib/db/schema";

const CATEGORIES = ["cosmetic", "service", "currency", "custom"] as const;
const KINDS = [
  "cape",
  "nick_effect",
  "pet",
  "title",
  "disc",
  "item",
  "chips",
  "frame",
  "profile_bg",
] as const;

function normalizePayload(value: unknown): string | null {
  if (value == null || value === "") return "{}";
  if (typeof value === "string") {
    try {
      JSON.parse(value);
      return value;
    } catch {
      return null;
    }
  }
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

/**
 * POST /api/admin/shop/products — создать товар.
 * PATCH /api/admin/shop/products — обновить товар по id.
 * Доступно только администраторам.
 */
export async function POST(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Нет прав" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const slug = typeof body?.slug === "string" ? body.slug.trim().toLowerCase() : "";
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const category = CATEGORIES.includes(body?.category) ? body.category : "cosmetic";
  const icon = typeof body?.icon === "string" && body.icon.trim() ? body.icon.trim() : "🎁";
  const priceBld = Number(body?.priceBld);
  const kind = KINDS.includes(body?.kind) ? body.kind : null;
  const payload = normalizePayload(body?.payload);
  const sortOrder = Number.isFinite(Number(body?.sortOrder)) ? Math.trunc(Number(body.sortOrder)) : 0;
  const maxPerUserRaw = body?.maxPerUser;
  const maxPerUser =
    maxPerUserRaw == null || maxPerUserRaw === ""
      ? null
      : Math.max(1, Math.trunc(Number(maxPerUserRaw)));
  const isActive = body?.isActive !== false;

  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json(
      { error: "slug обязателен: латиница, цифры и дефис" },
      { status: 400 }
    );
  }
  if (!title) {
    return NextResponse.json({ error: "title обязателен" }, { status: 400 });
  }
  if (!Number.isInteger(priceBld) || priceBld < 0) {
    return NextResponse.json({ error: "priceBld должен быть целым числом ≥ 0" }, { status: 400 });
  }
  if (!kind) {
    return NextResponse.json({ error: "Некорректный kind" }, { status: 400 });
  }
  if (payload == null) {
    return NextResponse.json({ error: "payload должен быть корректным JSON" }, { status: 400 });
  }
  if (maxPerUser != null && !Number.isFinite(maxPerUser)) {
    return NextResponse.json({ error: "maxPerUser должен быть числом" }, { status: 400 });
  }

  try {
    const inserted = await db
      .insert(shopProducts)
      .values({
        slug,
        title,
        description,
        category,
        icon,
        priceBld,
        kind,
        payload,
        isActive,
        sortOrder,
        maxPerUser,
      })
      .run();
    return NextResponse.json({ id: Number(inserted.lastInsertRowid) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("UNIQUE")) {
      return NextResponse.json({ error: "Товар с таким slug уже есть" }, { status: 409 });
    }
    console.error("Admin product create error:", error);
    return NextResponse.json({ error: "Не удалось создать товар" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Нет прав" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const id = Number(body?.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "id обязателен" }, { status: 400 });
  }

  const updates: Partial<typeof shopProducts.$inferInsert> = {};
  if (typeof body?.title === "string" && body.title.trim()) updates.title = body.title.trim();
  if (typeof body?.description === "string") updates.description = body.description.trim();
  if (CATEGORIES.includes(body?.category)) updates.category = body.category;
  if (typeof body?.icon === "string" && body.icon.trim()) updates.icon = body.icon.trim();
  if (body?.priceBld != null) {
    const price = Number(body.priceBld);
    if (!Number.isInteger(price) || price < 0) {
      return NextResponse.json({ error: "priceBld должен быть целым числом ≥ 0" }, { status: 400 });
    }
    updates.priceBld = price;
  }
  if (KINDS.includes(body?.kind)) updates.kind = body.kind;
  if (body?.payload != null) {
    const payload = normalizePayload(body.payload);
    if (payload == null) {
      return NextResponse.json({ error: "payload должен быть корректным JSON" }, { status: 400 });
    }
    updates.payload = payload;
  }
  if (typeof body?.isActive === "boolean") updates.isActive = body.isActive;
  if (body?.sortOrder != null && Number.isFinite(Number(body.sortOrder))) {
    updates.sortOrder = Math.trunc(Number(body.sortOrder));
  }
  if (body?.maxPerUser !== undefined) {
    updates.maxPerUser =
      body.maxPerUser == null || body.maxPerUser === ""
        ? null
        : Math.max(1, Math.trunc(Number(body.maxPerUser)));
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Нет полей для обновления" }, { status: 400 });
  }

  const result = await db
    .update(shopProducts)
    .set(updates)
    .where(eq(shopProducts.id, id))
    .run();
  if (result.rowsAffected === 0) {
    return NextResponse.json({ error: "Товар не найден" }, { status: 404 });
  }
  return NextResponse.json({ message: "OK" });
}
