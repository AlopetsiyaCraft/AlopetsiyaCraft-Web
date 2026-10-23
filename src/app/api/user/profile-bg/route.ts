import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { mkdirSync } from "fs";
import { unlink, writeFile } from "fs/promises";
import { join } from "path";
import sharp from "sharp";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { resolveUploadPath, uploadsDir } from "@/lib/uploads";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_EXT = ["png", "jpg", "jpeg", "webp"];
const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp"];

/** Удаляем старый файл фона, чтобы data/uploads не рос бесконечно. */
async function removeOld(url: string | null | undefined) {
  if (!url || !url.startsWith("/uploads/profile-bg/")) return;
  const path = resolveUploadPath(url);
  if (!path) return;
  try {
    await unlink(path);
  } catch {
    // файла уже нет — не страшно
  }
}

/**
 * POST /api/user/profile-bg — загрузить свой фон профиля.
 * Доступно только после разовой покупки «Свой фон профиля» в магазине.
 * Картинка обрезается под широкий баннер и сохраняется в WebP.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);

  const me = await db
    .select({
      profileBgUnlocked: users.profileBgUnlocked,
      profileBgImage: users.profileBgImage,
    })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  if (!me) {
    return NextResponse.json({ error: "Аккаунт не найден" }, { status: 404 });
  }
  if (!me.profileBgUnlocked) {
    return NextResponse.json(
      { error: "Свой фон не куплен — приобрети его в магазине" },
      { status: 403 }
    );
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Файл обязателен" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Файл больше 8 МБ" }, { status: 400 });
  }
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXT.includes(ext) || (file.type && !ALLOWED_MIME.includes(file.type))) {
    return NextResponse.json(
      { error: "Поддерживаются PNG, JPEG и WebP" },
      { status: 400 }
    );
  }

  let processed: Buffer;
  try {
    const input = Buffer.from(await file.arrayBuffer());
    processed = await sharp(input)
      .rotate()
      .resize(1600, 500, { fit: "cover", position: "center" })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    return NextResponse.json({ error: "Не удалось прочитать картинку" }, { status: 400 });
  }

  const dir = uploadsDir("profile-bg");
  mkdirSync(dir, { recursive: true });
  const filename = `profile-bg-${userId}-${Date.now()}.webp`;
  await writeFile(join(dir, filename), processed);
  const url = `/uploads/profile-bg/${filename}`;

  await db
    .update(users)
    .set({ profileBgImage: url, profileBg: null })
    .where(eq(users.id, userId))
    .run();

  await removeOld(me.profileBgImage);

  return NextResponse.json({ message: "Фон обновлён", profileBgImage: url });
}

/** DELETE /api/user/profile-bg — убрать свой фон (пресеты остаются доступны). */
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);

  const me = await db
    .select({ profileBgImage: users.profileBgImage })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  if (!me) {
    return NextResponse.json({ error: "Аккаунт не найден" }, { status: 404 });
  }

  await db
    .update(users)
    .set({ profileBgImage: null, profileBg: null })
    .where(eq(users.id, userId))
    .run();
  await removeOld(me.profileBgImage);

  return NextResponse.json({ message: "Фон удалён", profileBgImage: null });
}
