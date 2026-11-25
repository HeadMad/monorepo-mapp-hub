# RPC-мост и протокол

## Использование в мини-приложении
Подключить `miniapps/_sdk/mapp-bridge.js` классическим скриптом. Он создает глобальный объект `MappHub`:

```html
<script src="../_sdk/mapp-bridge.js"></script>
<script>
  const res = await MappHub.shell("checkUpdate", { includeBeta: false });
  if (res.ok) console.log(res.result);
  else console.error(res.message);
</script>
```

- `MappHub.<category>(<action>, <params>)` вызывает экшен `<category>.<action>`.
- Параметры передаются объектом (по умолчанию `{}`).
- Возвращается Promise с ответом `{ ok, result }` при успехе или `{ ok: false, message }` при ошибке.
- Обращение к `MappHub.then` возвращает `undefined`, поэтому объект безопасно `await`-ить без подмены.

## Транспорт (JSON-RPC 2.0 поверх postMessage)
Мост отправляет родителю (оболочке):
```json
{ "jsonrpc": "2.0", "method": "category.action", "params": {}, "id": "req_1" }
```
Оболочка отвечает:
```json
{ "jsonrpc": "2.0", "result": {}, "id": "req_1" }
```
или
```json
{ "jsonrpc": "2.0", "error": { "code": -32000, "message": "..." }, "id": "req_1" }
```
Мост принимает только сообщения от `window.parent` с известным `id`.

## Маршрутизация в оболочке
- `category.action` переводится в файл `js/api/<category>/<action>.js`, вызывается его default-экспорт `(params, context)`.
- Встроенные методы: `shell.navigate` (`{ url }`, путь относительно корня `www`), `shell.setTokens` (`{ tokens }`).
