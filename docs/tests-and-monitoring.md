# Тесты и мониторинг

## Тесты

Юнит-тесты на встроенном `node:test`, без дополнительных зависимостей:

```bash
npm test
```

Что покрыто:

- `tests/profileLayout.test.ts` — порядок, видимость, ширина блоков профиля;
- `tests/stats.test.ts` — форматирование времени и расстояний;
- `tests/inventory.test.ts` — разбор снимка инвентаря;
- `tests/market.test.ts` — комиссия и ключ предмета.

Перед коммитом полезно прогнать:

```bash
npm run typecheck
npm test
npm run lint
```

## Healthcheck

`GET /api/health`:

```json
{ "status": "ok", "db": "ok", "dbLatencyMs": 2, "uptimeSec": 1200 }
```

Если база не отвечает — `503` и `status: "error"`.

Проверка из консоли:

```bash
npm run healthcheck
```

Скрипт читает `WEBSITE_URL` из `.env` и завершается с кодом 1 при ошибке.
Его можно поставить в cron или подключить URL к UptimeRobot / Better Stack.

## Админка

`/admin/system` показывает:

- отклик базы и её размер;
- аптайм и память процесса;
- очередь выдачи заказов;
- активные лоты маркета;
- просмотры за последние сутки.

## Что ещё стоит добавить

- e2e-тест покупки и заявки на маркете на тестовой базе;
- проверку сборки `npm run build` в CI;
- внешний uptime-монитор на `/api/health`;
- ежедневный бэкап `data/database.db` и `data/uploads`.
