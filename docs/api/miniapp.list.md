# miniapp.list

Возвращает установленные мини-приложения из нативного реестра.

- **Обработчик:** `apps/shell-mobile/www/js/api/miniapp/list.js`
- **Разрешение:** не нужно
- **Статус:** реализован

## Вызов
```js
const { apps } = await MappHub.call("miniapp.list");
// apps: [{ id, name, version, icon, service }]
```

`icon` — путь из манифеста относительно приложения или `null`. `service: true` у служебных приложений, которые не показываются в сетке лаунчера.

Назад: [справочник API](README.md)
