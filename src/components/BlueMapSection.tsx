import BlueMapLauncher from "./BlueMapLauncher";

// Адрес веб-сервера BlueMap. По умолчанию мод слушает 127.0.0.1:8100;
// при желании можно переопределить в .env.local: BLUEMAP_URL=http://host:порт
const BLUEMAP_URL = (process.env.BLUEMAP_URL ?? "http://127.0.0.1:8100").replace(/\/+$/, "");

/**
 * 3D-карта мира (BlueMap) на главной странице.
 * Сама карта (iframe) монтируется только по клику на баннер —
 * см. BlueMapLauncher. Если веб-сервер мода не отвечает — заглушка.
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
        <BlueMapLauncher src={`${BLUEMAP_URL}/`} />
      ) : (
        <div className="rounded-xl border border-[var(--border)] p-8 text-center text-[var(--text-muted)] text-sm">
          Карта мира недоступна — Minecraft-сервер с модом BlueMap не запущен.
        </div>
      )}
    </section>
  );
}