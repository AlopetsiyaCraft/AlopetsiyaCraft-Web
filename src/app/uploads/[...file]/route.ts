import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { resolveUploadPath } from "@/lib/uploads";

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};

/**
 * Динамическая отдача загруженных файлов (скины, плащи, скриншоты).
 * Читает файл с диска на каждый запрос, поэтому свежезагруженные файлы
 * видны сразу и в dev, и в production (статику public/ next start
 * обслуживает по снимку на момент старта — новые файлы там давали бы 404).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ file: string[] }> }
) {
  const { file } = await params;
  const filepath = resolveUploadPath(`/uploads/${file.join("/")}`);

  if (!filepath) {
    return new NextResponse("Not Found", { status: 404 });
  }

  try {
    const data = await readFile(filepath);
    const ext = file[file.length - 1]?.split(".").pop()?.toLowerCase() ?? "";
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        // Нет immutable: скины перезаписываются по тому же URL (skin-<id>.png)
        // и браузер должен каждый раз перепроверять.
        "Cache-Control": "public, max-age=0, must-revalidate",
      },
    });
  } catch {
    return new NextResponse("Not Found", { status: 404 });
  }
}