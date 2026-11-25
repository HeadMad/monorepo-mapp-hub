# shell.navigate

Встроенный метод рантайма. Загружает страницу в iframe мини-приложения.

- **Обработчик:** `apps/shell-mobile/www/js/runtime.js` (`handleRpcMethod`)
- **Разрешение:** не нужно (пока, см. вопрос ниже)
- **Статус:** реализован

## Параметры
| Поле | Тип | Описание |
|---|---|---|
| `url` | string | Путь относительно корня `www`, например `miniapps/launcher/index.html` |

Относительные пути от самого мини-приложения (`../launcher/index.html`) не работают: `iframe.src` разрешается относительно `www/index.html`.

## Вызов
```js
await MappHub.shell("navigate", { url: "miniapps/sample-game/index.html" });
// { ok: true, result: { success: true } }
```

## Открытый вопрос
Переход на другое мини-приложение может считаться межприложенческим доступом и потребовать разрешение. Решение пока не принято.

Назад: [справочник API](README.md)
