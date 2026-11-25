# TASK-011: Методы тем в MappSystemPlugin

## Status: In Progress
## Priority: High
## Source: tasks/MAPP_ARCHITECTURE_PART2.md, разделы 2.2 и 4.2

### Description
Новые методы плагина `MappSystem`:
- `themeGetList()` -> `{ themes: [{ id, builtin }], activeThemeId }`
- `themeGetCss({ themeId })` -> `{ css }`
- `themeSave({ themeId, css })`: проверка id (`[a-z0-9_-]{1,32}`), канонизация CSS, запрет на перезапись `light`/`dark`. Если тема активная, сбрасывается кэш `theme.css` и отправляется событие `themeChanged`.
- `themeReset({ themeId })`: только для `light` и `dark`, возвращает заводскую CSS.
- `themeApply({ themeId })`: записывает `active_theme`, сбрасывает кэш `theme.css`, отправляет `themeChanged`.
- `invalidateAssetCache({ filename? })`: без `filename` сбрасывает весь кэш.

События: `notifyListeners("themeChanged", { themeId, timestamp })`. Рассылку во `iframe` делает JS-мост (TASK-013), нативный слой этого не делает.

Права доступа в мини-приложениях проверяет мост, а не плагин. Плагин доступен только оболочке.

### Files
- `apps/shell-mobile/native/android/com/mapphub/shell/MappSystemPlugin.java`

### Acceptance criteria
- `themeSave` для `light` возвращает ошибку `protected theme`.
- `themeApply` с несуществующим id возвращает ошибку.
- После `themeApply` `https://mapp.local/theme.css` отдает CSS новой темы.
- JS-слушатель `addListener('themeChanged')` получает событие.

### Depends on
- TASK-009, TASK-010.
