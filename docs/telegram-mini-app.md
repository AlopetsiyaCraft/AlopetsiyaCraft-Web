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

## Публикация

1. Сайт должен быть доступен по HTTPS с валидным сертификатом.
2. В [@BotFather](https://t.me/BotFather) создай бота и мини-приложение
   (`/newapp`), укажи публичный URL.
3. Кнопку Mini App можно повесить в меню бота или отправлять ссылку
   `https://t.me/<bot>/<app>`.

Для локальной машины без домена подойдёт временный туннель
(Cloudflare Tunnel / ngrok), но для постоянной работы нужен домен.

## Что можно добавить дальше

- Вход через Telegram (`initData` + проверка подписи на сервере).
- Уведомления в Telegram (бот пишет игроку о заказе или событии).
- Отдельная иконка и название мини-приложения.
