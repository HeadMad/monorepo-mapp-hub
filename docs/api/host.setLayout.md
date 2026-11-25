# host.setLayout

Управляет размещением служебного iframe (`#svc-host`) в оболочке: скрыть, поверх экрана или прижать к низу.

- **Обработчик:** `apps/shell-mobile/www/js/api/host/setLayout.js`
- **Разрешение:** `shell.host` (в `mappmanifest.json`)
- **Статус:** реализован

## Параметры
| Поле | Тип | Описание |
|---|---|---|
| `mode` | string | `hidden` (скрыт), `overlay` (поверх всего экрана), `dock` (прижат к низу) |
| `height` | number | Высота в пикселях для `dock`, до 300 |

## Вызов
```js
await MappHub.call("host.setLayout", { mode: "dock", height: 44 });
```

Назад: [справочник API](README.md)
