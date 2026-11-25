# RPC-протокол

Мини-приложение общается с оболочкой через `window.postMessage` по схеме JSON-RPC 2.0.

Запрос (мини-приложение -> оболочка):
```json
{ "jsonrpc": "2.0", "method": "category.action", "params": {}, "id": "req_1" }
```

Ответ (оболочка -> мини-приложение):
```json
{ "jsonrpc": "2.0", "result": {}, "id": "req_1" }
```
или
```json
{ "jsonrpc": "2.0", "error": { "code": -32000, "message": "..." }, "id": "req_1" }
```

Оболочка переводит `category.action` в файл `js/api/<category>/<action>.js` и вызывает его default-экспорт `(params, context)`.
Встроенные методы: `shell.navigate`, `shell.setTokens`.
