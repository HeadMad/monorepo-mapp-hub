# TASK-008: Проверка разрешений и изоляция хранилища

## Status: Backlog
## Priority: High

### Description
1. Рантайм должен проверять разрешения из `permissions` манифеста до вызова экшена, который их требует (см. `docs/permissions.md`).
2. `storage.get` привязать к `appId`, чтобы приложения не читали данные друг друга.
3. Решить открытые вопросы: класс `device.info`, `shell.navigate` на другое приложение, название разрешений `shell.tokens` и `miniapps.install`.
