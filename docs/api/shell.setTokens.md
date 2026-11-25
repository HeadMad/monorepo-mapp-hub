# shell.setTokens

Встроенный метод рантайма. Обновляет CSS-токены оболочки и рассылает их активному мини-приложению.

- **Обработчик:** `apps/shell-mobile/www/js/runtime.js` (`updateTokens`)
- **Разрешение:** предложено `shell.tokens` (токены влияют на все приложения)
- **Статус:** реализован, проверка разрешения не подключена

## Параметры
| Поле | Тип | Описание |
|---|---|---|
| `tokens` | object | Пары `имя: значение`. Имя превращается в CSS-переменную `--app-<имя>` |

## Вызов
```js
await MappHub.call("shell.setTokens", { tokens: { primary: "#22c55e" } });
// задает --app-primary и отправляет { type: "TOKENS_UPDATED", tokens } в iframe
```

Текущие токены описаны в `apps/shell-mobile/www/css/tokens.css`.

Назад: [справочник API](README.md)
