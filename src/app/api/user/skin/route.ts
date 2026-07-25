import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, skinHistory } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { writeFile } from "fs/promises";
import { join } from "path";
import { mkdirSync } from "fs";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("skin") as File;

    if (!file) {
      return NextResponse.json({ error: "Файл обязателен" }, { status: 400 });
    }

    if (!file.name.endsWith(".png") || file.type !== "image/png") {
      return NextResponse.json(
        { error: "Только PNG файлы (стандартный формат скина Minecraft)" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const filename = `skin-${session.user.id}.png`;
    const skinsDir = join(process.cwd(), "public", "uploads", "skins");
    mkdirSync(skinsDir, { recursive: true });
    const filepath = join(skinsDir, filename);

    await writeFile(filepath, buffer);

    const skinUrl = `/uploads/skins/${filename}`;

    db.update(users)
      .set({ skinUrl })
      .where(eq(users.id, parseInt(session.user.id)))
      .run();

    db.insert(skinHistory)
      .values({
        userId: parseInt(session.user.id),
        skinUrl,
      })
      .run();

    return NextResponse.json({ message: "Скин обновлён", skinUrl });
  } catch (error) {
    console.error("Skin upload error:", error);
    return NextResponse.json({ error: "Ошибка загрузки" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }

    db.update(users)
      .set({ skinUrl: null })
      .where(eq(users.id, parseInt(session.user.id)))
      .run();

    return NextResponse.json({ message: "Скин удалён" });
  } catch (error) {
    console.error("Skin delete error:", error);
    return NextResponse.json({ error: "Ошибка удаления" }, { status: 500 });
  }
}
