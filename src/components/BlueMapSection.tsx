// Адрес веб-сервера BlueMap. По умолчанию мод слушает 127.0.0.1:8100;
// при желании можно переопределить в .env.local: BLUEMAP_URL=http://host:порт
const BLUEMAP_URL = (process.env.BLUEMAP_URL ?? "http://127.0.0.1:8100").replace(/\/+$/, "");

/**
 * 3D-карта мира (BlueMap) — пиксельная панель: шапка, iframe и строка статуса.
 * Если веб-сервер мода не отвечает — заглушка.
 */
export default async function BlueMapSection({ showTitle = true }: { showTitle?: boolean }) {
  let available = false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`${BLUEMAP_URL}/`, { signal: controller.signal, cache: "no-store" });
    clearTimeout(timer);
    available = res.ok;
  } catch {
    available = false;
  }

  return (
    <section className="mb-6">
      <div className="mc-panel overflow-hidden">
        {showTitle && (
          <div className="mc-head">
            <span className="flex shrink-0 items-center text-[var(--mc-green-light)]">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                <path strokeLinecap="square" d="M9 20l-5 1V4l5-1m0 17l6-2m-6 2V3m6 15l5 1V4l-5 1m0 15V5m0 0L9 3" />
              </svg>
            </span>
            <h2 className="min-w-0 flex-1 truncate text-[0.78rem] font-bold uppercase tracking-[0.12em]">
              Карта мира
            </h2>
            <span className="mc-chip text-[0.6rem] text-[var(--text-secondary)]">BlueMap</span>
          </div>
        )}

        {available ? (
          <div className="bg-black">
            <iframe
              src={`${BLUEMAP_URL}/`}
              title="Карта мира BlueMap"
              className="block w-full"
              style={{ height: "47.6vh" }}
              scrolling="no"
              tabIndex={-1}
              allowFullScreen
            />
          </div>
        ) : (
          <div className="mc-inset m-3 flex flex-col items-center gap-2 px-6 py-10 text-center">
            <span className="mc-panel-flat flex h-12 w-12 items-center justify-center">
              <svg className="h-6 w-6 text-[var(--text-muted)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="square" d="M9 20l-5 1V4l5-1m0 17l6-2m-6 2V3m6 15l5 1V4l-5 1m0 15V5m0 0L9 3" />
              </svg>
            </span>
            <p className="text-sm font-semibold text-[var(--text-secondary)]">Карта недоступна</p>
            <p className="max-w-sm text-xs text-[var(--text-muted)]">
              Запусти Minecraft-сервер — BlueMap поднимется на порту 8100 и карта появится здесь.
            </p>
          </div>
        )}

        {available && (
          <div className="flex items-center justify-between gap-2 border-t-2 border-black bg-[var(--card-alt)] px-3 py-1.5 text-[0.65rem] uppercase tracking-wider text-[var(--text-muted)]">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 bg-[var(--mc-green-light)]" aria-hidden />
              Онлайн-карта
            </span>
            <a href={BLUEMAP_URL} target="_blank" rel="noreferrer" className="hover:text-[var(--mc-green-light)]">
              Открыть отдельно ↗
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
