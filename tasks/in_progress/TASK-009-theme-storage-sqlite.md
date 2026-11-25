# TASK-009: Хранение тем в SQLite

## Status: In Progress
## Priority: High
## Source: tasks/MAPP_ARCHITECTURE_PART2.md, разделы 2.1 и 2.2

### Description
Темы хранятся в `system_kv` в виде готовой CSS-строки `:root { --var: value; }`.
- Пресеты: `namespace = 'themes'`, `key = <theme_id>`.
- Активная тема: `namespace = 'config'`, `key = 'active_theme'`.
- Сидирование `light` и `dark` при создании базы и при каждом открытии через `INSERT OR IGNORE`. Причина: установки beta.3 уже имеют `mapp_system.db` версии 1, и `onCreate` для них не выполнится.
- Сохраняемая CSS канонизируется на стороне нативного кода: принимаются только блоки `:root { --name: value; ... }`, значения без `{ } < > @ \`, без `url(`. Ответ сохраняется в каноническом виде.
- Встроенные темы `light` и `dark` нельзя перезаписать через `themeSave`, для них есть `themeReset`, который возвращает заводские значения.

### Files
- `apps/shell-mobile/native/android/com/mapphub/shell/MappDatabaseHelper.java`
- `apps/shell-mobile/native/android/com/mapphub/shell/MappThemeCss.java` (валидация и канонизация)

### Acceptance criteria
- После установки на чистом устройстве и после обновления beta.3 -> beta.4 в `system_kv` есть `themes/light`, `themes/dark`, `config/active_theme=light`.
- Попытка сохранить CSS с `url(`, `@import`, `}` внутри значения или без блока `:root` возвращает ошибку.
- Значение, сохраненное через `themeSave`, читается через `themeGetCss` без изменений после канонизации.

### Depends on
- Нет.
