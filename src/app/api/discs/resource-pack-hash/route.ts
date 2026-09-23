import { NextResponse } from "next/server";
import { buildDiscPack } from "@/lib/discs/pack";

/**
 * GET /api/discs/resource-pack-hash — метаданные ресурспака пластинок.
 * Мод сравнивает хэш при входе игрока / выдаче пластинки и шлёт пак,
 * если тот изменился.
 */
export async function GET() {
  const { hash, trackCount } = await buildDiscPack();
  return NextResponse.json({
    url: "/api/discs/resource-pack",
    hash: trackCount > 0 ? hash : "",
    trackCount,
  });
}