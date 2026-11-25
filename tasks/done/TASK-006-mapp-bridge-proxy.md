# TASK-006: Мост MappHub на Proxy

## Status: Done
Глобальный объект `MappHub` (`miniapps/_sdk/mapp-bridge.js`): `MappHub.<category>(action, params)` -> Promise `{ ok, result | message }`.
Лаунчер и sample-game переведены на мост. Исправлен `shell.navigate` (пути относительно `www`) и версия в `shell.checkUpdate`.
Проверено в node с моком postMessage (успех, ошибка, чужой источник, `then`).
