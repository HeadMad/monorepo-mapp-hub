# miniapp.install

Устанавливает мини-приложение по его `mappmanifest.json`: показывает разрешения, предупреждает о снятых галочках, имитирует загрузку и сохраняет запись.

- **Файлы:** `apps/shell-mobile/www/js/api/miniapp/installWithPermissions.js` (основной), `apps/shell-mobile/www/js/api/miniapp/install.js` (старая версия без разрешений)
- **Разрешение:** предложено `miniapps.install` (межприложенческий доступ)
- **Статус:** реализован частично

## Параметры
| Поле | Тип | Описание |
|---|---|---|
| `manifestUrl` | string | URL до `mappmanifest.json` |
| `manifest` | object | Манифест целиком (если уже загружен). Приоритетнее `manifestUrl` |

## Вызов
```js
const res = await MappHub.miniapp("install", { manifestUrl: "https://.../mappmanifest.json" });
// { ok: true, result: { installed: true, appId, version } } | { ok: true, result: { installed: false } }
```

## Известные проблемы (неработает в текущем виде)
1. Экшен вызывает `context.updateModalMessage` и `context.hideModal`, но рантайм передает только `showModal`. Прогресс-бар и закрытие окна не работают.
2. Кнопка «Назад» в предупреждении вызывает `installWithPermissions(params, context)`. Такой функции в области видимости нет, поэтому возврат к чекбоксам падает.
3. Скачивание имитируется таймером, архив не загружается. Манифест `archiveUrl` пока не используется.
4. Установка записывается в `localStorage` без привязки к оболочке и без проверки разрешений.

Задача на исправление: [TASK-002](../../tasks/backlog/TASK-002-permissions-modal-flow.md), [TASK-003](../../tasks/backlog/TASK-003-download-progress-bar.md).

Назад: [справочник API](README.md)
