import "dotenv/config";

/**
 * Проверка живости сайта для cron/uptime-монитора.
 *   npm run healthcheck
 * Код выхода 0 — сайт и база отвечают, 1 — нет.
 */
async function main() {
  const base = (process.env.WEBSITE_URL ?? "http://127.0.0.1:3000").replace(/\/+$/, "");
  const url = `${base}/api/health`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok || body?.status !== "ok") {
      console.error(`healthcheck: FAIL ${res.status}`, body);
      process.exit(1);
    }
    console.log(
      `healthcheck: ok · db ${body.dbLatencyMs ?? "?"}ms · uptime ${body.uptimeSec ?? "?"}s`
    );
  } catch (error) {
    console.error("healthcheck: FAIL", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
