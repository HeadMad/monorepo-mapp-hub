# shell.checkUpdate

Загружает `release-manifest.json`, сравнивает версию оболочки с текущей и при наличии обновления показывает модальное окно.

- **Файл:** `apps/shell-mobile/www/js/api/shell/checkUpdate.js`
- **Разрешение:** не нужно (запрос делает сама оболочка)
- **Статус:** реализован. Текущая версия задана в коде: `0.1.0-beta.1`.

## Параметры
| Поле | Тип | По умолчанию | Описание |
|---|---|---|---|
| `includeBeta` | boolean | `false` | Сравнивать с `betaVersion`, а не с `version` |

## Вызов
```js
const res = await MappHub.shell("checkUpdate", { includeBeta: true });
// { ok: true, result: { currentVersion, targetVersion, hasUpdate, channel, changelog } }
```

## Известные ограничения
- Кнопка «Update Now» пока только пишет в консоль. Установка APK не реализована (TASK-004).
- Адрес манифеста жестко задан в коде и в `shell-config.json`.

Назад: [справочник API](README.md)
