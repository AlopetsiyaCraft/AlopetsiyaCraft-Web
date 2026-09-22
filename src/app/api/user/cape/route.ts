import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, capeHistory } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { writeFile } from "fs/promises";
import { join } from "path";
import { mkdirSync } from "fs";
import { createHash } from "crypto";
import { uploadsDir } from "@/lib/uploads";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("cape") as File;

    if (!file) {
      return NextResponse.json({ error: "Файл обязателен" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const ext = file.name.split(".").pop() || "png";
    const hash = createHash("md5").update(buffer).digest("hex").slice(0, 8);
    const filename = `cape-${session.user.id}-${Date.now()}-${hash}.${ext}`;
    const capesDir = uploadsDir("capes");
    mkdirSync(capesDir, { recursive: true });
    const filepath = join(capesDir, filename);

    await writeFile(filepath, buffer);

    const capeUrl = `/uploads/capes/${filename}`;

    await db
      .update(users)
      .set({ capeUrl })
      .where(eq(users.id, parseInt(session.user.id)))
      .run();

    const lastCape = await db
      .select({ capeUrl: capeHistory.capeUrl })
      .from(capeHistory)
      .where(eq(capeHistory.userId, parseInt(session.user.id)))
      .orderBy(capeHistory.id)
      .limit(1)
      .get();

    // Пропускаем запись, если загрузили ровно тот же файл (имя файла не
    // поменялось). Старые файлы не удаляем: каждая запись истории плащей
    // обязана показывать свою картинку, а не битую ссылку.
    if (!lastCape || lastCape.capeUrl !== capeUrl) {
      await db
        .insert(capeHistory)
        .values({
          userId: parseInt(session.user.id),
          capeUrl,
        })
        .run();
    }

    return NextResponse.json({ message: "Плащ обновлён", capeUrl });
  } catch (error) {
    console.error("Cape upload error:", error);
    return NextResponse.json({ error: "Ошибка загрузки" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }

    await db
      .update(users)
      .set({ capeUrl: null })
      .where(eq(users.id, parseInt(session.user.id)))
      .run();

    return NextResponse.json({ message: "Плащ удалён" });
  } catch (error) {
    console.error("Cape delete error:", error);
    return NextResponse.json({ error: "Ошибка удаления" }, { status: 500 });
  }
}
