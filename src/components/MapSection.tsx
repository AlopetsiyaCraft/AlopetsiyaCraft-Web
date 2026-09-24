import MapSwitcher, { type MapInfo } from "./MapSwitcher";

// Адреса веб-интерфейсов карт. По умолчанию: BlueMap — 127.0.0.1:8100,
// JourneyMap — 127.0.0.1:8080. Переопределяются в .env.local:
// BLUEMAP_URL=... и JOURNEYMAP_URL=...
const BLUEMAP_URL = (process.env.BLUEMAP_URL ?? "http://127.0.0.1:8100").replace(/\/+$/, "");
const JOURNEYMAP_URL = (process.env.JOURNEYMAP_URL ?? "http://127.0.0.1:8080").replace(/\/+$/, "");

/** Проверка, что веб-сервер карты поднят. */
async function isUp(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`${url}/`, { signal: controller.signal, cache: "no-store" });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Секция «Карта мира» на главной: вкладки BlueMap / JourneyMap.
 * Показываются только доступные (отвечающие) сервисы; если карта
 * поднимается позже — вкладка появится после перезагрузки страницы.
 */
export default async function MapSection() {
  const [blueUp, journeyUp] = await Promise.all([isUp(BLUEMAP_URL), isUp(JOURNEYMAP_URL)]);

  const maps: MapInfo[] = [];
  if (blueUp) maps.push({ id: "bluemap", label: "BlueMap", url: `${BLUEMAP_URL}/` });
  if (journeyUp) maps.push({ id: "journeymap", label: "JourneyMap", url: `${JOURNEYMAP_URL}/` });

  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold mb-3">Карта мира</h2>
      {maps.length > 0 ? (
        <MapSwitcher maps={maps} />
      ) : (
        <div className="rounded-xl border border-[var(--border)] p-8 text-center text-[var(--text-muted)] text-sm">
          Карты мира недоступны — веб-серверы BlueMap / JourneyMap не запущены.
        </div>
      )}
    </section>
  );
}