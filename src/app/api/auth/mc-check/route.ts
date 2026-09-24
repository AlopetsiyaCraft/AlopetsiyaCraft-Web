import { NextRequest, NextResponse } from "next/server";
import { and, eq, gt, sql, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, mcSessions, nameHistory } from "@/lib/db/schema";
import { checkBridgeKey } from "@/lib/bridge";

const MAX_NICKNAME = 32;

/**
 * Проверка игрока перед входом на Minecraft-сервер (мод AlopetsiyaAuth).
 *
 * POST /api/auth/mc-check  — тело: { "nickname": "AlexMilash", "ip": "1.2.3.4" }
 *
 *   - registered — зарегистрирован ли такой ник на сайте (вайтлист: если нет —
 *     мод кикает игрока с сообщением «зарегистрируйтесь на сайте»);
 *   - authorized — есть ли живая сессия с этого IP (пароль при входе не нужен);
 *   - previousNickname / previousNicknames — прошлые ники аккаунта (если игрок
 *     менял ник на сайте): мод при входе под новым ником копирует инвентарь
 *     (playerdata) и ванильную статистику с offline-UUID какого-то из прошлых
 *     ников на новый, чтобы смена ника не обнуляла предметы и прогресс.
 *
 * `ip` опционален (нужен только для проверки активной сессии; мод спрашивает
 * этот эндпоинт ещё до создания игрока — тогда IP ещё неизвестен). Ник ищется
 * без учёта регистра. Требует заголовок `x-api-key` = CHAT_API_KEY.
 */
export async function POST(request: NextRequest) {
  if (!checkBridgeKey(request.headers.get("x-api-key"))) {
    return NextResponse.json({ error: "Неверный ключ API" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const nickname =
    typeof body?.nickname === "string" ? body.nickname.trim().slice(0, MAX_NICKNAME) : "";
  const ip = typeof body?.ip === "string" ? body.ip.trim() : "";

  if (!nickname) {
    return NextResponse.json({ error: "Поле nickname обязательно" }, { status: 400 });
  }

  const lower = nickname.toLowerCase();

  const user = await db
    .select({ id: users.id, nickname: users.nickname })
    .from(users)
    .where(sql`lower(${users.nickname}) = ${lower}`)
    .get();

  if (!user) {
    return NextResponse.json({ registered: false, authorized: false });
  }

  // Все прошлые ники этого аккаунта (новые первыми) — мод берёт самый свежий
  // из них, у которого на сервере есть реальные данные (вещи/опыт), и
  // переносит прогресс под текущий ник. Цепочку A -> B(пустой вход) -> C
  // это тоже отрабатывает: пустой спас B пропускается, берётся A.
  const history = await db
    .select({ nickname: nameHistory.nickname })
    .from(nameHistory)
    .where(
      and(
        eq(nameHistory.userId, user.id),
        sql`lower(${nameHistory.nickname}) != ${user.nickname.toLowerCase()}`
      )
    )
    .orderBy(desc(nameHistory.id))
    .limit(20);

  const previousNicknames = history.map((h) => h.nickname);

  let authorized = false;
  if (ip) {
    const session = await db
      .select({ id: mcSessions.id })
      .from(mcSessions)
      .where(
        and(
          sql`lower(${mcSessions.nickname}) = ${lower}`,
          eq(mcSessions.ip, ip),
          gt(mcSessions.expiresAt, new Date())
        )
      )
      .limit(1)
      .get();
    authorized = !!session;
  }

  return NextResponse.json({
    registered: true,
    authorized,
    // Канонический ник сайта (регистр) — мод пускает под ним.
    nickname: user.nickname,
    // null, если игрок не менял ник; иначе самый свежий предыдущий ник.
    previousNickname:
      previousNicknames.length > 0 && previousNicknames[0].toLowerCase() !== lower
        ? previousNicknames[0]
        : null,
    // Все прошлые ники (самые свежие первыми) для переноса прогресса.
    previousNicknames,
  });
}