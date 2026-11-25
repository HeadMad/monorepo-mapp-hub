# notifications.alert

Показывает сообщение в едином модальном окне оболочки и ждет нажатия «OK».

- **Файл:** `apps/shell-mobile/www/js/api/notifications/alert.js`
- **Разрешение:** не нужно (UI оболочки, доступа к устройству нет)
- **Статус:** реализован

## Параметры
| Поле | Тип | Обязательно | По умолчанию |
|---|---|---|---|
| `title` | string | нет | «Системное уведомление» |
| `message` | string | нет | `""` |

## Вызов
```js
await MappHub.notifications("alert", { title: "Готово", message: "Файл сохранен" });
// { ok: true, result: { status: "acknowledged" } }
```

Назад: [справочник API](README.md)
