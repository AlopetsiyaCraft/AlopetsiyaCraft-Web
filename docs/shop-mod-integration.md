# Интеграция магазина с Minecraft (NeoForge)

Сайт не выполняет команды на сервере напрямую. Заказы складываются в очередь,
а мод забирает их и сообщает результат. Это безопаснее RCON и не требует
открывать порт Minecraft наружу.

## Эндпоинты

Оба требуют заголовок `x-api-key` со значением `CHAT_API_KEY` из `.env`.

### `GET /api/shop/orders/pending`

Возвращает все заказы в статусе `pending`:

```json
{
  "orders": [
    {
      "id": 12,
      "nickname": "Steve",
      "title": "Кастомный предмет",
      "kind": "item",
      "payload": {
        "material": "minecraft:diamond_sword",
        "name": "Клинок Алопеции",
        "lore": ["Выкован на сайте"],
        "enchants": { "minecraft:sharpness": 3 }
      },
      "createdAt": 1792705475000
    }
  ]
}
```

### `POST /api/shop/orders/result`

```json
{ "orderId": 12, "ok": true }
```

При ошибке:

```json
{ "orderId": 12, "ok": false, "error": "игрок офлайн" }
```

`ok: true` → заказ `delivered`.
`ok: false` → заказ `refunded`, BLD автоматически возвращаются игроку и
пишутся в историю операций.

## Виды заказов

| `kind` | `payload` | Автовыдача |
|---|---|---|
| `item` | `material`, `name`, `lore[]`, `enchants{}`, `count?` | да |
| `pet` | `mob`, `name` | да |
| `title` | `title` | да (титул нужно вывести в чате) |
| `nick_effect` | `style`, `colors[]` | да (эффект нужно вывести в чате) |
| `cape` | `design` | нет, вручную |
| `disc` | — | не через магазин |
| `chips` | `chips?` | на сайте, до мода не доходит |

## Правила очереди

- **Один заказ — одна выдача.** Сайт обновляет только `pending`, поэтому
  повторный `result` безопасен. Но если мод выдал предмет, а `result` не
  дошёл, заказ придёт снова. Веди локальный `Set<Long>` выданных id.
- **Офлайн.** Если игрока нет, не вызывай `result` — заказ дождётся входа.
- **Плащ.** `cape` остаётся `pending`, пока админ не выдаст его вручную.
- **Опрос.** 20–60 секунд достаточно. Не опрашивай чаще раза в 10 секунд.
- **Потоки.** HTTP — асинхронно; выдачу предметов и спавн — на главном
  потоке сервера (`server.execute`).
- **Безопасность.** Ключ только на сервере; проверяй `ResourceLocation`,
  ограничивай количество и уровни зачарований.

## Пример для NeoForge

В `examples/neoforge-shop/` лежит каркас:

- `ShopConfig` — URL, ключ, интервал;
- `ShopOrderPoller` — опрос и отправка результата;
- `ShopOrderHandler` — выдача предмета/питомца/титула.

Подключение в главном классе мода:

```java
@SubscribeEvent
public static void onServerTick(ServerTickEvent.Post event) {
    ShopOrderPoller.tick(event.getServer());
}
```

## Проверка

```bash
# очередь
KEY=$(grep '^CHAT_API_KEY=' .env | cut -d= -f2-)
curl -s -H "x-api-key: $KEY" http://localhost:3000/api/shop/orders/pending

# отметить выполненным
curl -s -X POST -H "x-api-key: $KEY" -H 'Content-Type: application/json' \
  -d '{"orderId":12,"ok":true}' \
  http://localhost:3000/api/shop/orders/result
```

Если после выдачи сайт вернул `401`, проверь, что `CHAT_API_KEY` совпадает
с ключом сайта. Если `404` — заказ уже обработан или удалён.
