import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { audioTracks } from "@/lib/db/schema";
import { AUDIO_EXT, MAX_AUDIO_BYTES, audioRoot, trackFilePath } from "@/lib/audio";

/**
 * POST /api/audio/upload — загрузка mp3 в личную библиотеку.
 * Только авторизованный пользователь; файл кладётся в data/audio/<userId>/.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }
    const userId = parseInt(session.user.id, 10);

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Файл обязателен" }, { status: 400 });
    }

    const name = file.name.toLowerCase();
    if (!name.endsWith(AUDIO_EXT)) {
      return NextResponse.json(
        { error: `Разрешены только файлы ${AUDIO_EXT}` },
        { status: 400 }
      );
    }

    if (file.size > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        { error: `Файл больше 15 МБ (${(file.size / 1024 / 1024).toFixed(1)} МБ)` },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json({ error: "Файл пустой" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const fileName = `${randomUUID()}${AUDIO_EXT}`;
    const dir = audioRoot(String(userId));
    await mkdir(dir, { recursive: true });
    await writeFile(trackFilePath(userId, fileName), buffer);

    const cleanTitle = file.name.replace(/\.mp3$/i, "").trim().slice(0, 100) || "Без названия";

    const result = await db
      .insert(audioTracks)
      .values({ userId, title: cleanTitle, fileName, size: file.size })
      .returning({ id: audioTracks.id, title: audioTracks.title, createdAt: audioTracks.createdAt })
      .get();

    return NextResponse.json(
      {
        id: result.id,
        title: result.title,
        url: `/api/audio/${result.id}/file`,
      },
      { status: 201 }
    );
  } catch (e) {
    console.error("Ошибка загрузки аудио:", e);
    return NextResponse.json({ error: "Ошибка сервера при загрузке" }, { status: 500 });
  }
}