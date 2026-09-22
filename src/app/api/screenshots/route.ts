import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { screenshots } from "@/lib/db/schema";
import { writeFile } from "fs/promises";
import { join } from "path";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const seasonId = formData.get("seasonId") as string;
    const caption = formData.get("caption") as string;

    if (!file || !seasonId) {
      return NextResponse.json(
        { error: "Файл и сезон обязательны" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const timestamp = Date.now();
    const filename = `${timestamp}-${file.name}`;
    const filepath = join(process.cwd(), "public", "uploads", filename);

    await writeFile(filepath, buffer);

    const imageUrl = `/uploads/${filename}`;

    const result = await db
      .insert(screenshots)
      .values({
        userId: parseInt(session.user.id),
        seasonId: parseInt(seasonId),
        imageUrl,
        caption: caption || null,
      })
      .returning()
      .get();

    return NextResponse.json(
      { message: "Скриншот загружен", id: result.id },
      { status: 201 }
    );
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Ошибка загрузки" },
      { status: 500 }
    );
  }
}
