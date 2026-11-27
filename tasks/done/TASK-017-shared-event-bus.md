# TASK-017: Общий канал событий (bus) для мини-приложений

## Status: Done
## Priority: High
## Source: docs/api/bus.md
## Shipped: 0.2.0-beta.6 (82c1b47), доработки в 0.2.0-beta.7 (80d0869)

### Description
Общее пространство сообщений: мини-приложения и оболочка публикуют события, подписчики получают нужные им. Реализация: `apps/shell-mobile/www/js/bridge/bus.js`, SDK `miniapps/_sdk/MappHub.js` (`bus.publish`, `bus.subscribe`), relay для мини-приложений в окне браузера.

### Acceptance
- [x] Буфер 500 сообщений, лимит данных 10 КБ (`BUFFER_SIZE`, `MAX_DATA_BYTES` в `bus.js`).
- [x] Подписки по `type` (точное значение или префикс `*`) и `app`; адресные сообщения `to`; replay через `subscribe(filter, fn, { replay: true })`.
- [x] Сообщения консоли не возвращаются в саму консоль (`bus.js`).
- [x] `bus.publish` и `bus.subscribe` подключены в `runtime.js` и SDK.
- [x] Юнит-тесты `tests/bus/bus.test.mjs` входят в `npm test` (проверено: 36/36 при последнем запуске).
- [ ] Метод `request` с таймаутом не реализован: убран из спецификации, ответ оформляется сообщением `reply:<id>`.
- [ ] Открытые вопросы из `docs/api/bus.md` (приватность, права доступа к шине) не закрыты.
- [ ] На устройстве не проверялось.

### Depends on
- TASK-012 (события SDK, протокол `__mapp_event__`).
- TASK-018 (консоль) — первый потребитель шины.
