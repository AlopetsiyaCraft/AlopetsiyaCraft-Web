import { NextRequest, NextResponse } from "next/server";
import { buildDiscPack } from "@/lib/discs/pack";

/**
 * GET /api/discs/resource-pack — zip ресурспака с обложками пластинок.
 * Серверный мод шлёт этот URL клиентам (player.connection.sendResourcePack);
 * клиент скачивает пак только если SHA-1 хэш отличается.
 */
export async function GET(_request: NextRequest) {
  const { hash, buffer } = await buildDiscPack();
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Length": String(buffer.byteLength),
      ETag: `"${hash}"`,
      "Cache-Control": "public, max-age=3600",
      "Content-Disposition": 'attachment; filename="alopetsiyacraft-discs.zip"',
    },
  });
}