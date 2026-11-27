# TASK-019: Системные диалоги и панель установки как миниприложение поверх шины

## Status: In Progress
## Priority: High
## Source: docs/api/bus.md, TASK-017, TASK-018
## Commits: c02f73c, 2fde214 (not yet released)

### Description
Алерты, подтверждения, модалка обновления оболочки и панель установки рисует мини-приложение `com.mapphub.dialogs` (`miniapps/dialogs`). Оболочка общается с ним по шине через `DialogClient` (`apps/shell-mobile/www/js/dialogs/client.js`). `ModalEngine` удалён. API `alert`, `confirm`, `install`, `checkUpdate` работают поверх этого обмена.

### Acceptance
- [x] `com.mapphub.dialogs` (0.1.0-beta.2) — служебное, предустановленное.
- [x] `DialogClient` заменил `ModalEngine`; `context.showModal`, `openModal`, `toast`, `install` идут через `dialog.open` / `dialog.result` и `install.*`.
- [x] Предустановка при старте (`installer/preinstalled.js`): ставится, если версии нет или она старее.
- [x] Тесты `tests/dialogs/client.test.mjs` входят в `npm test`.
- [x] Нативные отступы перенесены на `android.R.id.content` (`MainActivity.java`). По коду.
- [ ] На устройстве или эмуляторе не проверялось: модалки, подтверждения, панель установки, отступы, поведение при установке из Market.
- [ ] Каталог GitHub Pages содержит `dialogs.zip` — выполняется при выпуске 0.2.0-beta.11.

### Depends on
- TASK-017 (общий канал событий).
- TASK-018 (консоль как миниприложение: та же схема предустановки).
