import { db } from "@/lib/db";
import { seasons } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export default async function SeasonBuildPage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number } = await params;
  const seasonNumber = parseInt(number);

  const season = await db
    .select()
    .from(seasons)
    .where(eq(seasons.number, seasonNumber))
    .get();

  return (
    <div className="py-8">
      <h2 className="text-2xl font-bold mb-6">Сборка</h2>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-8">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">📦</div>
          <h3 className="text-xl font-semibold mb-2">
            Сборка для Сезона {seasonNumber}
          </h3>
          <p className="text-[var(--text-secondary)]">
            Скачайте сборку модов для подключения к серверу
          </p>
        </div>

        {season?.modpackUrl ? (
          <div className="text-center">
            <a
              href={season.modpackUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-8 py-3 bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-medium rounded-lg transition-colors"
            >
              Скачать сборку
            </a>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-[var(--text-muted)] mb-4">
              Ссылка на сборку пока не добавлена.
            </p>
            <div className="inline-block px-4 py-2 bg-[var(--bg)] rounded text-sm text-[var(--text-muted)]">
              Администратор может добавить ссылку в настройках сезона
            </div>
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-[var(--border)]">
          <h4 className="font-medium mb-4">Инструкция по установке:</h4>
          <ol className="list-decimal list-inside space-y-2 text-sm text-[var(--text-secondary)]">
            <li>Скачайте сборку по ссылке выше</li>
            <li>Распакуйте архив в папку с Minecraft</li>
            <li>Запустите Minecraft через Fabric/Forge</li>
            <li>Подключитесь к серверу</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
