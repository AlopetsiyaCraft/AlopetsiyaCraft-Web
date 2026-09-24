import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { achievements } from "@/lib/db/schema";
import { checkBridgeKey } from "@/lib/bridge";
import { notifyDiscord } from "@/lib/discord";

const MAX_NICKNAME = 32;
const MAX_TITLE = 100;
const MAX_DESC = 300;
const MAX_ADVANCEMENT_ID = 120;
const MAX_ICON = 64;
const FRAMES = ["task", "goal", "challenge"] as const;
/** Одна и та же запись (ник + заголовок) в течение этого окна не пишется дважды. */
const DEDUPE_MS = 2 * 60 * 1000;

/**
 * Мост достижений: мод на Minecraft-сервере (расширение chatbridge) сообщает
 * о полученном игроком достижении (advancement).
 *
 * POST /api/achievements/from-server  — внешние системы шлют:
 *   { nickname, title, [advancementId], [description], [frame], [icon] }
 *   frame: "task" | "goal" | "challenge" (по умолчанию "task").
 *   Запись дублируется не чаще раза в 2 минуты на пару (ник, заголовок).
 *   Достижение дополнительно публикуется в Discord через вебхук (как чат).
 *
 * Требует заголовок `x-api-key`, совпадающий с CHAT_API_KEY в .env.
 */
export async function POST(request: NextRequest) {
  if (!checkBridgeKey(request.headers.get("x-api-key"))) {
    return NextResponse.json({ error: "Неверный ключ API" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const nickname = typeof body?.nickname === "string" ? body.nickname.trim().slice(0, MAX_NICKNAME) : "";
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, MAX_TITLE) : "";

  if (!nickname || !title) {
    return NextResponse.json({ error: "nickname и title обязательны" }, { status: 400 });
  }

  const advancementId =
    typeof body?.advancementId === "string" ? body.advancementId.trim().slice(0, MAX_ADVANCEMENT_ID) : "";
  const description =
    typeof body?.description === "string" ? body.description.trim().slice(0, MAX_DESC) : null;
  const frame = FRAMES.includes(body?.frame) ? body.frame : "task";
  const icon = typeof body?.icon === "string" ? body.icon.trim().slice(0, MAX_ICON) : "";

  // Защита от дублей (мод мог переотправить, игрок — повторно получить то же самое).
  const duplicate = await db
    .select({ id: achievements.id })
    .from(achievements)
    .where(
      and(
        eq(achievements.nickname, nickname),
        eq(achievements.title, title),
        gt(achievements.createdAt, new Date(Date.now() - DEDUPE_MS))
      )
    )
    .orderBy(desc(achievements.createdAt))
    .limit(1)
    .get();
  if (duplicate) {
    return NextResponse.json({ message: "OK" });
  }

  await db
    .insert(achievements)
    .values({ nickname, title, advancementId, description, frame, icon })
    .run();

  // Анонс в Discord (тот же вебхук, что у чата; ник и голова — из вебхука).
  await notifyDiscord({ source: "minecraft", nickname, message: `получил достижение «${title}» 🏆` });

  return NextResponse.json({ message: "OK" });
}