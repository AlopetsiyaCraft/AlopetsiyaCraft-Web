import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { resolveUploadPath } from "@/lib/uploads";

export const runtime = "nodejs";

/**
 * PNG головы игрока (128x128): базовый слой (8,8) + оверлей (40,8)
 * со смешиванием по альфе — как голова в игре и на сайте.
 * Публичный, используется Discord-ботом для аватарки участников
 * (server avatar) и может использоваться где угодно ещё.
 *
 * GET /api/chat/head/image?nickname=AlexMilash
 */
export async function GET(request: NextRequest) {
  const nickname = (request.nextUrl.searchParams.get("nickname") ?? "").trim().slice(0, 32);
  if (!nickname) {
    return NextResponse.json({ error: "nickname обязателен" }, { status: 400 });
  }

  const user = await db
    .select({ skinUrl: users.skinUrl })
    .from(users)
    .where(eq(users.nickname, nickname))
    .limit(1)
    .get();
  if (!user?.skinUrl) {
    return NextResponse.json({ error: "Скин не найден" }, { status: 404 });
  }

  const path = resolveUploadPath(user.skinUrl);
  if (!path) {
    return NextResponse.json({ error: "Некорректный путь скина" }, { status: 404 });
  }

  let png: Buffer;
  try {
    const opts = { limitInputPixels: false };
    const base = sharp(path, opts).extract({ left: 8, top: 8, width: 8, height: 8 });
    const overlay = sharp(path, opts).extract({ left: 40, top: 8, width: 8, height: 8 });
    // Оверлей заранее масштабируем до размера базы, иначе composite положит его 8x8 в угол.
    const overlayBuf = await overlay.resize(128, 128, { kernel: "nearest" }).png().toBuffer();
    png = await base
      .resize(128, 128, { kernel: "nearest" })
      .composite([{ input: overlayBuf, blend: "over" }])
      .png()
      .toBuffer();
  } catch {
    return NextResponse.json({ error: "Не удалось отрендерить голову" }, { status: 500 });
  }

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
    },
  });
}