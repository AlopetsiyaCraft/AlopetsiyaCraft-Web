import Link from "next/link";
import ServerIp from "@/components/mc/ServerIp";

/**
 * Первый экран главной: пиксельный «ночной» hero с названием сервера,
 * IP-адресом, живым онлайном и ключевыми цифрами.
 */
export default function Hero({
  activeSeason,
  totalPlayers,
  totalAchievements,
  online,
}: {
  activeSeason: number | null;
  totalPlayers: number;
  totalAchievements: number;
  online: number;
}) {
  return (
    <section className="mc-hero-bg force-dark relative overflow-hidden border-b-2 border-black">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:py-16 lg:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="mc-chip text-[0.65rem] text-[var(--mc-green-light)]">
                <span className="h-2 w-2 animate-pulse bg-[var(--mc-green-light)]" aria-hidden />
                {online > 0 ? `В сети: ${online}` : "Сервер онлайн"}
              </span>
              {activeSeason != null && (
                <span className="mc-chip text-[0.65rem] text-[var(--mc-gold)]">
                  Сезон {activeSeason}
                </span>
              )}
              <span className="mc-chip text-[0.65rem] text-[var(--text-secondary)]">
                Java 1.21.1
              </span>
            </div>

            <h1 className="mc-title text-[clamp(1.9rem,8vw,4rem)] text-[var(--text)]">
              Алопеция<span className="text-[var(--mc-green-light)]">Крафт</span>
            </h1>

            <p className="mt-4 max-w-xl text-base leading-relaxed text-[var(--text-secondary)] sm:text-lg">
              Уютный Minecraft-сервер для своих: выживание, сезоны, ивенты,
              музыка из пластинок и живая карта мира. Заходи — место найдётся.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <ServerIp />
              <Link href="#map" className="mc-btn">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="square" d="M9 20l-5 1V4l5-1m0 17l6-2m-6 2V3m6 15l5 1V4l-5 1m0 15V5m0 0L9 3" />
                </svg>
                Карта мира
              </Link>
            </div>
          </div>

          {/* Правая панель со статистикой */}
          <div className="mc-panel p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between border-b-2 border-black/50 pb-2">
              <span className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                Сводка сервера
              </span>
              <span className="flex gap-1" aria-hidden>
                <span className="h-2 w-2 bg-[var(--mc-red)]" />
                <span className="h-2 w-2 bg-[var(--mc-gold)]" />
                <span className="h-2 w-2 bg-[var(--mc-green)]" />
              </span>
            </div>

            <dl className="grid grid-cols-2 gap-3">
              <Stat label="Игроков" value={totalPlayers} tone="text-[var(--mc-green-light)]" />
              <Stat label="Сейчас в сети" value={online} tone="text-[var(--mc-gold)]" />
              <Stat label="Достижений" value={totalAchievements} tone="text-[var(--mc-blue)]" />
              <Stat label="Сезонов" value={activeSeason ?? 0} tone="text-[var(--text)]" />
            </dl>

            <div className="mc-inset mt-4 px-3 py-2.5">
              <div className="text-[0.62rem] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                Статус
              </div>
              <div className="mt-1 flex items-center gap-2 text-sm text-[var(--mc-green-light)]">
                <span className="h-2 w-2 animate-pulse bg-[var(--mc-green-light)]" aria-hidden />
                Сервер принимает игроков
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="mc-inset px-3 py-2">
      <dt className="text-[0.6rem] uppercase tracking-[0.14em] text-[var(--text-muted)]">{label}</dt>
      <dd className={`font-mono text-2xl leading-tight ${tone}`}>
        {value.toLocaleString("ru-RU")}
      </dd>
    </div>
  );
}
