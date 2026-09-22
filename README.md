# AlopetsiyaCraft Website

Сайт для Minecraft-сервера АлопецияКрафт.

## Стек

- Next.js 16, React 19, Tailwind CSS 4
- Drizzle ORM + SQLite (libsql: локальный файл **или** облачная база Turso)
- NextAuth 5 (credentials)
- skinview3d (3D-просмотр скинов и плащей)

## Запуск

```bash
npm install
npm run seed        # первый запуск: заполняет сезоны 1–4
npm run dev         # или: npm run build && npm start
```

Открой http://localhost:3000.

> ⚠️ После свежего `npm install` выполни `node scripts/patch-skinview3d.js` —
> он включает прозрачный фон в 3D-просмотре скинов.

## Конфигурация (.env)

Скопируй `.env.example` → `.env` и заполни:

| Переменная | Назначение |
|---|---|
| `AUTH_SECRET` | Секрет NextAuth. Генерация: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `DATABASE_URL` | **`file:./data/database.db`** — локальный файл (по умолчанию) или **`libsql://...`** — облачная база |
| `DATABASE_AUTH_TOKEN` | Токен Turso (только для облачной базы) |
| `CHAT_API_KEY` | Ключ чат-моста для мода Minecraft и Discord-бота (заголовок `x-api-key`) |

### Почему облачная база (Turso)?

Локальная база (`data/database.db`) и загруженные файлы (`public/uploads/`)
не хранятся в git — после переустановки Windows и клонирования репозитория
аккаунты пропадут. Чтобы этого избежать, перенеси базу в облако:

1. Зарегистрируйся на https://turso.tech (бесплатно).
2. Создай базу:
   ```bash
   npm i -g @libsql/turso
   turso auth login
   turso db create alopetsiyacraft
   ```
3. Получи адрес и токен:
   ```bash
   turso db list                 # колонка URL → libsql://...
   turso db tokens create alopetsiyacraft
   ```
4. Пропиши их в `.env`:
   ```
   DATABASE_URL=libsql://alopetsiyacraft-<org>.turso.io
   DATABASE_AUTH_TOKEN=<токен>
   ```
5. Перезапусти сайт — таблицы создадутся автоматически. Данные текущей
   локальной базы можно перенести через админ-панель Turso (`turso db shell`)
   или просто заново зарегистрировать аккаунты — после этого они уже
   не потеряются при переустановке системы.

> Код работает одинаково с обоими вариантами — меняется только `DATABASE_URL`.
> Пароли всегда хранятся как bcrypt-хеши.

## Структура базы

9 таблиц: `users`, `seasons`, `screenshots`, `comments`, `chat_logs`,
`players_online`, `skin_history`, `name_history`, `cape_history`.

## Что не хранится в git

- `data/` — локальная SQLite-база и загруженные файлы (скины, плащи, скриншоты)
- `public/uploads/` — больше не используется (файлы переехали в `data/uploads/`)
- `.env*` — секреты (кроме `.env.example`)

## Чат-мост с сервером Minecraft

На сервере стоит NeoForge-мод `chatbridge` (исходники в `IdeaProjects/chatbridge`),
который связывает игровой чат с сайтом:

- **Сервер → сайт**: мод шлёт `POST /api/chat/from-server` с заголовком
  `x-api-key: <CHAT_API_KEY>` и телом `{"nickname": "...", "message": "..."}`
  (игровой чат, заход/выход игроков). Сообщения сохраняются с `source="minecraft"`.
- **Сайт → сервер**: мод поллит `GET /api/chat/from-server?since=<мс>` и выводит
  в игру сообщения с `source="website"` (чат с сайта) и `source="discord"`
  (будущий Discord-бот). Свои же сообщения сервера в ответе исключаются —
  мод не выводит их в игру повторно (нет эффекта эха). `createdAt` отдаётся
  в миллисекундах, как ожидает мод.
- **Настройка на сервере**: в `config/chatbridge-common.toml` укажи
  `websiteUrl` (URL сайта) и `chatApiKey`, совпадающий с `CHAT_API_KEY` в `.env`.

Мод умеет помечать источник префиксом: `[Сайт]` (зелёный) и `[Discord]`
(фиолетовый). Связка «сайт → Discord» (вебхук) и «Discord → сайт/сервер» (бот)
планируется следующим этапом.