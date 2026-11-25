# storage.get

Читает значение по ключу и возвращает его как JSON.

- **Файл:** `apps/shell-mobile/www/js/api/storage/get.js`
- **Разрешение:** не нужно после изоляции по приложениям
- **Статус:** реализован, но не изолирован

## Известная проблема
Сейчас ключ берется как `"mapp_store_" + key` в общем `localStorage` оболочки. Любое мини-приложение может прочитать данные другого. Пока это не исправлено, экшен нельзя считать песочницей. Исправление: префикс должен включать `appId` из манифеста, см. [TASK-008](../../tasks/backlog/TASK-008-permission-enforcement.md).

## Вызов
```js
const res = await MappHub.storage("get", { key: "score" });
// { ok: true, result: { key: "score", value: 42 } }
// значение отсутствует -> { ok: true, result: { key: "score", value: null } }
```

Назад: [справочник API](README.md)
