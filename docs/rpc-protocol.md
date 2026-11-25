# RPC-мост и протокол

Мост для мини-приложений: [miniapps/_sdk/mapp-bridge.js](../miniapps/_sdk/mapp-bridge.js). Как им пользоваться, см. [руководство](miniapp-development.md). Список экшенов: [api/README.md](api/README.md).

## Транспорт (JSON-RPC 2.0 поверх postMessage)

Запрос от мини-приложения к оболочке:
```json
{ "jsonrpc": "2.0", "method": "category.action", "params": {}, "id": "req_1" }
```

Успешный ответ:
```json
{ "jsonrpc": "2.0", "result": {}, "id": "req_1" }
```

Ошибка:
```json
{ "jsonrpc": "2.0", "error": { "code": -32000, "message": "..." }, "id": "req_1" }
```

Мост превращает это в `{ ok, result }` или `{ ok: false, message }` и принимает ответы только от `window.parent` с известным `id`.

## Маршрутизация в оболочке

- `category.action` переводится в `js/api/<category>/<action>.js`, вызывается default-экспорт `(params, context)`.
- Встроенные методы: `shell.navigate` (`{ url }`) и `shell.setTokens` (`{ tokens }`), см. [api/shell.navigate.md](api/shell.navigate.md) и [api/shell.setTokens.md](api/shell.setTokens.md).
- Код `-32601` в ответе означает, что метод или файл экшена не найден.
- Разрешения проверяются до вызова экшена. Пока это не подключено, см. [permissions.md](permissions.md).

Назад: [документация](README.md)
