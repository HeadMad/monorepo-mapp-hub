# TASK-013: Мост оболочки: темы, разрешения и рассылка событий

## Status: In Progress
## Priority: High
## Source: tasks/MAPP_ARCHITECTURE_PART2.md, разделы 2.2, 3.1 и 6.2

### Description
Файл `apps/shell-mobile/www/js/bridge/MappHostBridge.js`. Источник сообщения проверяется по `WeakMap<Window, appId>`, origin должен быть `https://miniapp-<appId>.local`.
- Методы RPC `theme.getList`, `theme.getCss`, `theme.save`, `theme.apply` проксируются в плагин.
- Таблица разрешений: `theme.getList` и `theme.getCss` требуют `system.theme.read`, `theme.save` и `theme.apply` требуют `system.theme.write`. Разрешения мини-приложения берутся из `system_registry.manifest_json`. Без разрешения вернуть ошибку `permission denied`.
- `mountMiniApp(iframe, appId, permissions)`: сохраняет разрешения для appId.
- `broadcastEvent(event, payload)`: отправляет `{ __mapp_event__: true, event, payload, timestamp }` во все зарегистрированные `iframe`, `targetOrigin` = origin мини-приложения.
- Подписка на `MappSystem.themeChanged` вызывает `broadcastEvent('themeChanged', payload)` и генерирует `CustomEvent('mapp:event')` для самой оболочки.
- `apps/shell-mobile/www/js/runtime.js` импортирует `startMappHostBridge()`.

Ограничение: iframe встроенных мини-приложений сейчас грузятся с origin оболочки, а не с `miniapp-<id>.local`. Из-за проверки origin мост для них не отвечает. Это задача TASK-016.

### Files
- `apps/shell-mobile/www/js/bridge/MappHostBridge.js`
- `apps/shell-mobile/www/js/runtime.js`

### Acceptance criteria
- Вызов `theme.save` без `system.theme.write` возвращает `permission denied`.
- Вызов с правом возвращает результат и не падает при отсутствии плагина.
- `broadcastEvent` доставляет событие каждому зарегистрированному iframe. Проверяется в тесте.

### Depends on
- TASK-011.
