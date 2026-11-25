# TASK-012: Шина событий SDK и бесшовная смена CSS темы

## Status: In Progress
## Priority: High
## Source: tasks/MAPP_ARCHITECTURE_PART2.md, разделы 2.3 и 3

### Description
Файл `miniapps/_sdk/MappHub.js` (исходник, в сборке копируется в `www/assets/MappHub.js`).
- Протокол событий: сообщение с полем `__mapp_event__: true`, `event`, `payload`, `timestamp`. Ответы на RPC используют поле `jsonrpc` и `id`, поэтому две ветки не пересекаются.
- `MappHub.events.on / off / once`: возвращают функцию отписки. Ошибка одного подписчика не блокирует остальных.
- `reloadThemeCss()` (Double Buffering): новый `<link>` вставляется после `#mapp-theme-css` с `?v=<timestamp>`. В `onload` старый удаляется, новый получает id. В `onerror` новый удаляется, старый остается.
- Внутренняя подписка на `themeChanged` вызывает `reloadThemeCss()`.
- `MappHub.theme.getList / getCss / save / apply`: тонкие обертки над RPC.
- `ui.getThemeTokens` и `ui.onThemeChanged` из Части 1 сохраняются.

Примечание: `miniapps/_sdk/mapp-bridge.js` (старый клиент с `{ ok, result }`) используется `launcher` и `sample-game`. Оба клиента задают `window.MappHub`, поэтому одновременно в одном окне их подключать нельзя. Миграцию старых мини-приложений на новый SDK нужно запланировать отдельно (см. TASK-016).

### Files
- `miniapps/_sdk/MappHub.js`

### Acceptance criteria
- Событие `themeChanged` вызывает `reloadThemeCss()` ровно один раз.
- Во время перезагрузки в DOM всегда есть хотя бы один `<link id="mapp-theme-css">`, либо один без id во время загрузки.
- `once` срабатывает ровно один раз. Функция отписки отключает подписчика.

### Depends on
- TASK-011 (имена методов), TASK-013 (рассылка).

### Tests
- Логика событий и Double Buffering покрывается тестами в `tests/sdk/` (node + jsdom-заглушка), см. TASK-014.
