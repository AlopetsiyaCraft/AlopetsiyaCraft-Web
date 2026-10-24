import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

/**
 * GET /api/health — healthcheck для мониторинга.
 * 200 и { status: "ok" } если база отвечает; 503 в остальных случаях.
 */
export async function GET() {
  const started = Date.now();
  try {
    await db.run(sql`select 1`);
    return NextResponse.json(
      {
        status: "ok",
        db: "ok",
        dbLatencyMs: Date.now() - started,
        uptimeSec: Math.round(process.uptime()),
        memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
        timestamp: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Healthcheck error:", error);
    return NextResponse.json(
      {
        status: "error",
        db: "error",
        uptimeSec: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
