# TASK-018: Консоль как миниприложение

## Status: Backlog
## Priority: High
## Source: docs/api/bus.md, TASK-013, docs/api/console.*.md

### Description
Переписать отладочную консоль из `apps/shell-mobile/www/js/console/debugConsole.js` в служебное миниприложение `com.mapphub.console` (`service: true`).

- Переключатель «Консоль» в настройках лаунчера: при включении консоль запускается в режиме `dock` (`host.setLayout`), при выключении — `hidden`.
- Консоль подписывается на `{ type: "console.*" }` через шину (TASK-017) и выводит сообщения по приложениям.
- `MappHub.js` переназначает `console.log/info/warn/error/debug` и публикует `console.<level>` с `data.text` вместо RPC `console.write`.
- Оболочка публикует свои сообщения с `app = "shell"`.
- Консоль не публикует собственные `console.*` (защита от петли).
- Затронутые API: `console.setVisible`, `console.getState`, `console.write` — решить, удалять ли их после переноса (предложение: оставить алиасы на время перехода).

### Acceptance
- [ ] Консоль работает как миниприложение, в лаунчере скрыта (`service: true`).
- [ ] Переключатель в настройках лаунчера показывает и скрывает консоль в dock.
- [ ] Логи приложений и оболочки приходят в консоль через шину.
- [ ] Логи, созданные до запуска консоли, видны после запуска (если принят replay из `docs/api/bus.md`).
- [ ] Документация `docs/api/console.*.md` обновлена или помечена как устаревшая.

### Depends on
- TASK-017 (общий канал событий).
- TASK-013 (host bridge и события).
