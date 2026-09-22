import { db } from "@/lib/db";
import { chatLogs } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export default async function SeasonChatPage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number } = await params;
  const seasonNumber = parseInt(number);

  const messages = await db
    .select()
    .from(chatLogs)
    .where(eq(chatLogs.seasonId, seasonNumber))
    .orderBy(desc(chatLogs.createdAt))
    .limit(100)
    .all();

  return (
    <div className="py-8">
      <h2 className="text-2xl font-bold mb-6">Лог чата</h2>

      {messages.length === 0 ? (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-12 text-center">
          <div className="text-6xl mb-4">💬</div>
          <h3 className="text-xl font-semibold mb-2">Пока нет сообщений</h3>
          <p className="text-[var(--text-secondary)]">
            Сообщения из чата Minecraft будут отображаться здесь.
          </p>
        </div>
      ) : (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {messages.map((msg) => (
              <div key={msg.id} className="flex gap-2 text-sm">
                <span className="text-[var(--text-muted)] text-xs whitespace-nowrap">
                  {new Date(msg.createdAt).toLocaleTimeString("ru-RU", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="text-[#7c3aed] font-medium whitespace-nowrap">
                  {msg.nickname}
                </span>
                <span className="text-[var(--text-secondary)]">{msg.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
