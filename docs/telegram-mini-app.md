# Telegram Mini App

Сайт можно открыть как мини-приложение Telegram. Отдельной сборки нет:
тот же сайт, но с учётом safe-area и кнопки «назад» Telegram.

## Что уже сделано

- В `layout.tsx` подключён официальный SDK `telegram-web-app.js`.
- `TelegramWebApp` при запуске внутри Telegram:
  - вызывает `ready()` и `expand()`;
  - красит шапку и фон в цвет сайта (`#121212`);
  - переносит `safeAreaInset` / `contentSafeAreaInset` в CSS-переменные
    `--tg-safe-*`;
  - обновляет `--tg-viewport-height` при изменении окна;
  - показывает кнопку «назад» на всех страницах, кроме главной.
- В `globals.css` добавлены `viewport-fit=cover`, отступы под вырез экрана
  и безопасные зоны для шапки и плавающего чата.
- Вход остаётся обычным (ник + пароль). Авторизация по Telegram не включена.

## Локальная проверка

Telegram открывает мини-приложения только по публичному HTTPS. На
`localhost` можно проверить вёрстку и логику без Telegram:

1. Открой мобильную ширину (390 px) в DevTools.
2. Убедись, что сайт работает как обычно.
3. Для проверки Telegram-ветки можно подставить заглушку в консоли:

```js
window.Telegram = { WebApp: {
  initData: '', platform: 'android', colorScheme: 'dark',
  viewportHeight: 700, viewportStableHeight: 690,
  ready() {}, expand() {}, setHeaderColor() {}, setBackgroundColor() {},
  onEvent() {}, offEvent() {},
  safeAreaInset: { top: 10, bottom: 20, left: 0, right: 0 },
  contentSafeAreaInset: { top: 12, bottom: 22, left: 0, right: 0 },
  BackButton: { show() {}, hide() {}, onClick() {}, offClick() {} },
}};
```

После этого `document.documentElement.dataset.telegram` станет `"1"`,
а `--tg-safe-top` / `--tg-safe-bottom` получат значения из заглушки.

## Мини-приложение без хостинга (туннель)

Хостинг не обязателен: достаточно HTTPS-туннеля на локальный порт 3000.
Компьютер и туннель должны оставаться включёнными.

### ngrok

```bash
brew install ngrok/ngrok/ngrok
ngrok config add-authtoken <токен из dashboard.ngrok.com>
ngrok http 3000
```

ngrok покажет адрес вида `https://xxxx.ngrok-free.app`. Открой его в
браузере — должна открыться главная сайта.

### Cloudflare Tunnel (без аккаунта)

```bash
npm run tunnel
```

Скрипт сам запустит `cloudflared`, дождётся публичного адреса и напишет его
в терминал крупно, а также сохранит в `/tmp/alopetsiya-tunnel-url.txt`.
Адрес вида `https://xxxx.trycloudflare.com`.

Если `cloudflared` не установлен:

```bash
brew install cloudflared
```

После перезапуска туннеля адрес меняется.

### Подключение к Telegram

1. Создай бота: в [@BotFather](https://t.me/BotFather) команда `/newbot`.
2. Команда `/newapp` → выбери бота → название, описание, иконка.
3. В поле **Web App URL** вставь HTTPS-адрес из ngrok/cloudflared.
4. Открой ссылку `https://t.me/<бот>/<короткое_имя>`.

Если адрес туннеля изменился, снова открой `/newapp` → выбери приложение →
**Edit Web App URL** и вставь новый адрес.

Внутри Telegram вход остаётся обычным: ник Minecraft и пароль. Сессия
хранится в WebView Telegram. Авторизация по `initData` пока не включена.

### Если туннель не открывается

- проверь, что `curl http://localhost:3000/api/health` отвечает `ok`;
- открой публичный URL в обычном браузере — он должен показать сайт;
- корпоративный Wi-Fi/провайдер может блокировать долгие туннельные
  соединения: попробуй мобильный интернет или другой сервис;
- бесплатные туннели иногда показывают свою страницу-заглушку (например,
  localtunnel просит IP) — для Telegram лучше ngrok или cloudflared.

## Публикация

1. Сайт должен быть доступен по HTTPS с валидным сертификатом.
2. В [@BotFather](https://t.me/BotFather) создай бота и мини-приложение
   (`/newapp`), укажи публичный URL.
3. Кнопку Mini App можно повесить в меню бота или отправлять ссылку
   `https://t.me/<bot>/<app>`.

Для постоянной работы нужен домен: временный туннель меняет адрес после
перезапуска.

## Что можно добавить дальше

- Вход через Telegram (`initData` + проверка подписи на сервере).
- Уведомления в Telegram (бот пишет игроку о заказе или событии).
- Отдельная иконка и название мини-приложения.
