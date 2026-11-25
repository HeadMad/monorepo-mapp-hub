# device.info

Возвращает платформу, user agent, размер окна и время на стороне оболочки.

- **Файл:** `apps/shell-mobile/www/js/api/device/info.js`
- **Разрешение:** `device.info` (класс «нативные функции»)
- **Статус:** реализован. Проверка выданного разрешения в рантайме пока не подключена.

## Вызов
```js
const res = await MappHub.device("info");
```

## Ответ
```json
{ "ok": true, "result": {
  "platform": "mobile-capacitor",
  "userAgent": "...",
  "screen": { "width": 390, "height": 844 },
  "timestamp": 1764062400000
} }
```

Назад: [справочник API](README.md)
