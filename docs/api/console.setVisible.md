# console.setVisible

Показывает или скрывает полоску консоли отладки оболочки. По умолчанию консоль скрыта при каждом запуске.

- **Обработчик:** `apps/shell-mobile/www/js/api/console/setVisible.js`
- **Разрешение:** не нужно
- **Статус:** реализован

## Параметры
| Поле | Тип | Описание |
|---|---|---|
| `visible` | boolean | `true` показать полоску, `false` скрыть (и свернуть раскрытую консоль) |

## Вызов
```js
await MappHub.call("console.setVisible", { visible: true });
// { visible: true, count: 12 }
```

Назад: [справочник API](README.md)
