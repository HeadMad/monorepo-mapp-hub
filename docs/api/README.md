# Справочник API

Все экшены вызываются через мост `MappHub` (см. [руководство](../miniapp-development.md)):

```js
const res = await MappHub.<category>("<action>", { ...params });
// res = { ok: true, result } | { ok: false, message }
```

Экшен `category.action` соответствует файлу `apps/shell-mobile/www/js/api/<category>/<action>.js` (default-экспорт `(params, context)`). Встроенные методы `shell.navigate` и `shell.setTokens` обрабатываются в `runtime.js` напрямую.

## Реализованные экшены

| Метод | Описание | Разрешение | Файл |
|---|---|---|---|
| `device.info` | Информация об устройстве и экране | `device.info` | [device.info](device.info.md) |
| `notifications.alert` | Сообщение в модальном окне оболочки | не нужно | [notifications.alert](notifications.alert.md) |
| `storage.get` | Чтение значения из хранилища | не нужно (после изоляции) | [storage.get](storage.get.md) |
| `shell.navigate` | Переход на страницу внутри `www` | не нужно (см. открытый вопрос) | [shell.navigate](shell.navigate.md) |
| `shell.setTokens` | Обновление CSS-токенов оболочки | `shell.tokens` (предложено) | [shell.setTokens](shell.setTokens.md) |
| `shell.checkUpdate` | Проверка обновления оболочки | не нужно | [shell.checkUpdate](shell.checkUpdate.md) |
| `miniapp.install` | Установка мини-приложения с разрешениями | `miniapps.install` (предложено) | [miniapp.install](miniapp.install.md) |

Модели разрешений: [../permissions.md](../permissions.md). Протокол: [../rpc-protocol.md](../rpc-protocol.md).
