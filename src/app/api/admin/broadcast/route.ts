import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notifications, users } from "@/lib/db/schema";
import { getAdminUser } from "@/lib/admin";
import { logAdminAction } from "@/lib/adminAudit";
import { announceToChat } from "@/lib/chatAnnounce";
import { notifyDiscordEvent } from "@/lib/discord";

/**
 * POST /api/admin/broadcast { title, body, link?, chat?, discord? }
 * Рассылка уведомлений всем игрокам. Дополнительно может уйти в чат и Discord.
 */
export async function POST(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Нет прав" }, { status: 403 });
  }

  const payload = await request.json().catch(() => null);
  const title = typeof payload?.title === "string" ? payload.title.trim() : "";
  const body = typeof payload?.body === "string" ? payload.body.trim() : "";
  const link =
    typeof payload?.link === "string" && payload.link.trim().startsWith("/")
      ? payload.link.trim().slice(0, 300)
      : null;

  if (!title || title.length > 120) {
    return NextResponse.json({ error: "Заголовок: от 1 до 120 символов" }, { status: 400 });
  }
  if (body.length > 1000) {
    return NextResponse.json({ error: "Текст: не больше 1000 символов" }, { status: 400 });
  }

  const allUsers = await db.select({ id: users.id }).from(users).all();
  if (allUsers.length > 0) {
    await db
      .insert(notifications)
      .values(
        allUsers.map((user) => ({
          userId: user.id,
          type: "broadcast",
          title,
          body: body || null,
          link,
        }))
      )
      .run();
  }

  if (payload?.chat === true) {
    await announceToChat(`📢 ${title}${body ? ` — ${body}` : ""}`);
  }

  if (payload?.discord !== false) {
    await notifyDiscordEvent({
      title: `📢 ${title}`,
      description: body || "Объявление администрации",
      link: link ?? "/",
    });
  }

  await logAdminAction({
    admin,
    action: "broadcast",
    targetType: "all_users",
    targetId: null,
    details: `${title} · получателей: ${allUsers.length}`,
  });

  return NextResponse.json({
    message: "Рассылка отправлена",
    recipients: allUsers.length,
  });
}
