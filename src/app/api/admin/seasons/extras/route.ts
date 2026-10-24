import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getAdminUser } from "@/lib/admin";
import { logAdminAction } from "@/lib/adminAudit";
import { db } from "@/lib/db";
import {
  seasonEvents,
  seasonResults,
  seasonRewards,
  seasons,
} from "@/lib/db/schema";

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toInt(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : fallback;
}

/**
 * POST /api/admin/seasons/extras
 * { type: event|reward|result, action: save|delete, id?, seasonId, ... }
 * События таймлайна, награды и итоги сезона.
 */
export async function POST(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Нет прав" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const type = body?.type;
  const action = body?.action === "delete" ? "delete" : "save";
  const id = body?.id != null ? toInt(body.id) : null;
  const seasonId = toInt(body?.seasonId);

  if (type !== "event" && type !== "reward" && type !== "result") {
    return NextResponse.json({ error: "type: event, reward или result" }, { status: 400 });
  }
  if (action === "delete") {
    if (!id || id <= 0) {
      return NextResponse.json({ error: "id обязателен" }, { status: 400 });
    }
    const table = type === "event" ? seasonEvents : type === "reward" ? seasonRewards : seasonResults;
    await db.delete(table).where(eq(table.id, id)).run();
    await logAdminAction({
      admin,
      action: "season.extras",
      targetType: type,
      targetId: id,
      details: "удалено",
    });
    return NextResponse.json({ message: "Удалено" });
  }

  const season = await db.select({ id: seasons.id, number: seasons.number }).from(seasons).where(eq(seasons.id, seasonId)).get();
  if (!season) {
    return NextResponse.json({ error: "Сезон не найден" }, { status: 404 });
  }

  if (type === "event") {
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const startsAt = parseDate(body?.startsAt);
    const endsAt = body?.endsAt ? parseDate(body.endsAt) : null;
    const description =
      typeof body?.description === "string" ? body.description.trim().slice(0, 1000) || null : null;
    const icon = typeof body?.icon === "string" && body.icon.trim() ? body.icon.trim().slice(0, 8) : "📌";
    if (!title) return NextResponse.json({ error: "Название события обязательно" }, { status: 400 });
    if (!startsAt) return NextResponse.json({ error: "Дата события некорректна" }, { status: 400 });

    const values = { seasonId, title, description, startsAt, endsAt, icon };
    if (id) {
      await db.update(seasonEvents).set(values).where(eq(seasonEvents.id, id)).run();
    } else {
      await db.insert(seasonEvents).values(values).run();
    }
    await logAdminAction({
      admin,
      action: "season.extras",
      targetType: "season_event",
      targetId: id ?? season.number,
      details: `Сезон ${season.number}: ${title}`,
    });
    return NextResponse.json({ message: "Событие сохранено" });
  }

  if (type === "reward") {
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    if (!title) return NextResponse.json({ error: "Название награды обязательно" }, { status: 400 });
    const values = {
      seasonId,
      title,
      description:
        typeof body?.description === "string" && body.description.trim()
          ? body.description.trim().slice(0, 500)
          : null,
      place: body?.place ? Math.max(1, Math.min(100, toInt(body.place))) : null,
      rewardBld: Math.max(0, toInt(body?.rewardBld)),
      rewardChips: Math.max(0, toInt(body?.rewardChips)),
    };
    if (id) {
      await db.update(seasonRewards).set(values).where(eq(seasonRewards.id, id)).run();
    } else {
      await db.insert(seasonRewards).values(values).run();
    }
    await logAdminAction({
      admin,
      action: "season.extras",
      targetType: "season_reward",
      targetId: id ?? season.number,
      details: `Сезон ${season.number}: ${title}`,
    });
    return NextResponse.json({ message: "Награда сохранена" });
  }

  const nickname = typeof body?.nickname === "string" ? body.nickname.trim() : "";
  const place = Math.max(1, Math.min(100, toInt(body?.place, 1)));
  if (!nickname) {
    return NextResponse.json({ error: "Ник победителя обязателен" }, { status: 400 });
  }
  const values = {
    seasonId,
    place,
    nickname: nickname.slice(0, 32),
    note:
      typeof body?.note === "string" && body.note.trim()
        ? body.note.trim().slice(0, 200)
        : null,
    rewardBld: Math.max(0, toInt(body?.rewardBld)),
    rewardChips: Math.max(0, toInt(body?.rewardChips)),
  };
  if (id) {
    await db.update(seasonResults).set(values).where(eq(seasonResults.id, id)).run();
  } else {
    await db.insert(seasonResults).values(values).run();
  }
  await logAdminAction({
    admin,
    action: "season.extras",
    targetType: "season_result",
    targetId: id ?? season.number,
    details: `Сезон ${season.number}: #${place} ${nickname}`,
  });
  return NextResponse.json({ message: "Итог сохранён" });
}
