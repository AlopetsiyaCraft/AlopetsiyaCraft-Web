import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { achievements, userFrames, users } from "@/lib/db/schema";
import {
  NICK_COLORS,
  PROFILE_BACKGROUNDS,
  PROFILE_FRAMES,
  SOCIAL_KEYS,
  parseFeaturedAchievements,
  type SocialKey,
} from "@/lib/profileCustomization";

const HEX_RE = /^#[0-9a-f]{6}$/i;

/**
 * POST /api/user/profile — сохранить кастомизацию профиля.
 * Статус, цвет ника, фон, рамка, соцсети и до 3 закреплённых достижений.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);

  const me = await db
    .select({ id: users.id, nickname: users.nickname })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  if (!me) {
    return NextResponse.json({ error: "Аккаунт не найден" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);

  const nickColorRaw = typeof body?.nickColor === "string" ? body.nickColor.trim() : "";
  const nickColorOk =
    nickColorRaw === "" ||
    NICK_COLORS.some((c) => c.id === nickColorRaw) ||
    HEX_RE.test(nickColorRaw);
  if (!nickColorOk) {
    return NextResponse.json({ error: "Некорректный цвет ника" }, { status: 400 });
  }

  const profileBgRaw = typeof body?.profileBg === "string" ? body.profileBg.trim() : "";
  const profileBgOk =
    profileBgRaw === "" ||
    PROFILE_BACKGROUNDS.some((b) => b.id === profileBgRaw) ||
    HEX_RE.test(profileBgRaw);
  if (!profileBgOk) {
    return NextResponse.json({ error: "Некорректный фон профиля" }, { status: 400 });
  }

  const profileFrameRaw =
    typeof body?.profileFrame === "string" ? body.profileFrame.trim() : "";
  let profileFrameValue: string | null = null;
  if (profileFrameRaw && profileFrameRaw !== "none") {
    const frameOk = PROFILE_FRAMES.some(
      (f) => f.id === profileFrameRaw && f.id !== "none"
    );
    if (!frameOk) {
      return NextResponse.json({ error: "Некорректная рамка профиля" }, { status: 400 });
    }
    // Рамку можно выбрать только после покупки в магазине.
    const owned = await db
      .select({ id: userFrames.id })
      .from(userFrames)
      .where(
        and(eq(userFrames.userId, userId), eq(userFrames.frameId, profileFrameRaw))
      )
      .get();
    if (!owned) {
      return NextResponse.json(
        { error: "Эта рамка не куплена — её можно приобрести в магазине" },
        { status: 403 }
      );
    }
    profileFrameValue = profileFrameRaw;
  }

  const socials: Partial<Record<SocialKey, string>> = {};
  const socialsInput = body?.socials;
  if (socialsInput != null) {
    if (typeof socialsInput !== "object" || Array.isArray(socialsInput)) {
      return NextResponse.json({ error: "socials должен быть объектом" }, { status: 400 });
    }
    for (const key of SOCIAL_KEYS) {
      const value = (socialsInput as Record<string, unknown>)[key];
      if (value == null || value === "") continue;
      if (typeof value !== "string") {
        return NextResponse.json({ error: `Некорректная соцсеть: ${key}` }, { status: 400 });
      }
      const trimmed = value.trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 200);
      if (trimmed) socials[key] = trimmed;
    }
  }

  let featuredIds: number[] = [];
  if (body?.featuredAchievements != null) {
    if (!Array.isArray(body.featuredAchievements)) {
      return NextResponse.json(
        { error: "featuredAchievements должен быть массивом" },
        { status: 400 }
      );
    }
    featuredIds = body.featuredAchievements
      .map((id: unknown) => Number(id))
      .filter((id: number) => Number.isInteger(id) && id > 0)
      .slice(0, 3);

    if (featuredIds.length > 0) {
      // Закрепить можно только свои достижения.
      const mine = await db
        .select({ id: achievements.id })
        .from(achievements)
        .where(
          and(
            eq(achievements.nickname, me.nickname),
            inArray(achievements.id, featuredIds)
          )
        )
        .all();
      const allowed = new Set(mine.map((row) => row.id));
      featuredIds = featuredIds.filter((id) => allowed.has(id));
    }
  }

  await db
    .update(users)
    .set({
      nickColor: nickColorRaw || null,
      profileBg: profileBgRaw || null,
      // Выбор пресета заменяет загруженную картинку; если пресет не выбран,
      // свой фон остаётся как есть.
      ...(profileBgRaw ? { profileBgImage: null } : {}),
      profileFrame: profileFrameValue,
      socials: JSON.stringify(socials),
      featuredAchievements: JSON.stringify(featuredIds),
    })
    .where(eq(users.id, userId))
    .run();

  return NextResponse.json({
    message: "Профиль сохранён",
    profile: {
      nickColor: nickColorRaw,
      profileBg: profileBgRaw,
      profileFrame: profileFrameValue ?? "",
      socials,
      featuredAchievements: parseFeaturedAchievements(JSON.stringify(featuredIds)),
    },
  });
}
