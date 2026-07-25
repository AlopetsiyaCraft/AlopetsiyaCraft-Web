import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { seasons } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  const allSeasons = db.select().from(seasons).orderBy(desc(seasons.number)).all();
  return NextResponse.json(allSeasons);
}
