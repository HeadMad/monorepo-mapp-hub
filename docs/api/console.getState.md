# console.getState

Возвращает состояние консоли отладки оболочки.

- **Обработчик:** `apps/shell-mobile/www/js/api/console/getState.js`
- **Разрешение:** не нужно
- **Статус:** реализован

## Вызов
```js
const { visible, count } = await MappHub.call("console.getState");
```

Поля ответа: `visible` (полоска показана), `count` (число сообщений в ленте).

Назад: [справочник API](README.md)
