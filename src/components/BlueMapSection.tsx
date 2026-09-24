// Адрес веб-сервера BlueMap. По умолчанию мод слушает 127.0.0.1:8100;
// при желании можно переопределить в .env.local: BLUEMAP_URL=http://host:порт
const BLUEMAP_URL = (process.env.BLUEMAP_URL ?? "http://127.0.0.1:8100").replace(/\/+$/, "");

/**
 * 3D-карта мира (BlueMap) — блок в стиле «Чат сервера»: карточка с шапкой
 * и заголовком «Карта мира» внутри блока. iframe без lazy-загрузки (чтобы
 * появление фрейма не давало скачков скролла), без внутреннего скролла и
 * без фокуса. Если веб-сервер мода не отвечает — заглушка.
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
    <section className="mb-8">
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
        {showTitle && (
          <div className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-2">
            <h2 className="font-semibold">Карта мира</h2>
          </div>
        )}
        {available ? (
          <div className="bg-black">
            <iframe
              src={`${BLUEMAP_URL}/`}
              title="Карта мира BlueMap"
              className="w-full block"
              style={{ height: "47.6vh" }}
              scrolling="no"
              tabIndex={-1}
              allowFullScreen
            />
          </div>
        ) : (
          <div className="p-8 text-center text-[var(--text-muted)] text-sm">
            Карта мира недоступна — Minecraft-сервер с модом BlueMap не запущен.
          </div>
        )}
      </div>
    </section>
  );
}