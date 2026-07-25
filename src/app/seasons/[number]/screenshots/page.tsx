import { db } from "@/lib/db";
import { screenshots, users } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";

export default async function SeasonScreenshotsPage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number } = await params;
  const seasonNumber = parseInt(number);
  const session = await auth();

  const seasonScreenshots = db
    .select({
      id: screenshots.id,
      imageUrl: screenshots.imageUrl,
      caption: screenshots.caption,
      createdAt: screenshots.createdAt,
      authorNickname: users.nickname,
    })
    .from(screenshots)
    .leftJoin(users, eq(screenshots.userId, users.id))
    .where(eq(screenshots.seasonId, seasonNumber))
    .orderBy(desc(screenshots.createdAt))
    .all();

  return (
    <div className="py-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Скриншоты</h2>
        {session && (
          <button className="px-4 py-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white rounded-lg text-sm transition-colors">
            Загрузить скриншот
          </button>
        )}
      </div>

      {seasonScreenshots.length === 0 ? (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-12 text-center">
          <div className="text-6xl mb-4">📸</div>
          <h3 className="text-xl font-semibold mb-2">Пока нет скриншотов</h3>
          <p className="text-[var(--text-secondary)]">
            Будьте первым, кто загрузит скриншот из этого сезона!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {seasonScreenshots.map((screenshot) => (
            <div
              key={screenshot.id}
              className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden"
            >
              <div className="aspect-video bg-[var(--bg)] flex items-center justify-center">
                <img
                  src={screenshot.imageUrl}
                  alt={screenshot.caption || "Скриншот"}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-4">
                {screenshot.caption && (
                  <p className="text-sm mb-2">{screenshot.caption}</p>
                )}
                <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                  <span>{screenshot.authorNickname}</span>
                  <span>
                    {new Date(screenshot.createdAt).toLocaleDateString("ru-RU")}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
