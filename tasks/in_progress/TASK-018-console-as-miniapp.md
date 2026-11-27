# TASK-018: Консоль как миниприложение

## Status: In Progress
## Priority: High
## Source: docs/api/bus.md, TASK-013, docs/api/console.*.md (удалены в 0.2.0-beta.7)

### Description
Отладочная консоль работает как предустановленное служебное мини-приложение `com.mapphub.console` (`service: true`, `preinstalled: true`, версия 0.1.0-beta.4). Логи идут через шину: `MappHub.js` переопределяет `console.log/info/warn/error/debug` и публикует `console.<level>`.

### Acceptance
- [x] Консоль — миниприложение `com.mapphub.console`, служебное, ставится при старте из `apps/shell-mobile/www/preinstalled/`.
- [x] Переключатель в лаунчере публикует `shell.console.toggle` (beta.7); консоль показывается в dock и сворачивается кнопкой (beta.10). По коду, на устройстве не проверено.
- [x] Логи приложений и оболочки идут через шину (`MappHub.js`, `console.<level>`).
- [x] Публичные API `console.setVisible`, `console.getState`, `console.write` и их документация удалены (beta.7).
- [ ] Логи, созданные до запуска консоли, видны после её запуска (replay): не проверено.
- [ ] Удалить `apps/shell-mobile/www/js/console/debugConsole.js`: grep по `apps/`, `miniapps/`, `tests/`, `scripts/` не находит импортов.

### Depends on
- TASK-017 (общий канал событий) — выполнено.
- TASK-013 (мост оболочки, темы и события).
