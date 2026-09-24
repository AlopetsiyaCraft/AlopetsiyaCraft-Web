// Адрес веб-сервера BlueMap. По умолчанию мод слушает 127.0.0.1:8100;
// при желании можно переопределить в .env.local: BLUEMAP_URL=http://host:порт
const BLUEMAP_URL = (process.env.BLUEMAP_URL ?? "http://127.0.0.1:8100").replace(/\/+$/, "");

/**
 * 3D-карта мира (BlueMap) на главной странице — встроена сразу.
 * iframe без lazy-загрузки (чтобы появление фрейма не давало скачков
 * скролла), без внутреннего скролла и без фокуса.
 * Если веб-сервер мода не отвечает — заглушка.
 */
export default async function BlueMapSection() {
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
    <section className="mt-8">
      <h2 className="text-xl font-semibold mb-3">Карта мира</h2>
      {available ? (
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-black">
          <iframe
            src={`${BLUEMAP_URL}/`}
            title="Карта мира BlueMap"
            className="w-full"
            style={{ height: "70vh" }}
            scrolling="no"
            tabIndex={-1}
            allowFullScreen
          />
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--border)] p-8 text-center text-[var(--text-muted)] text-sm">
          Карта мира недоступна — Minecraft-сервер с модом BlueMap не запущен.
        </div>
      )}
    </section>
  );
}