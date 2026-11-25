# TASK-014: Мини-приложение «Редактор тем»

## Status: In Progress
## Priority: Medium
## Source: tasks/MAPP_ARCHITECTURE_PART2.md, раздел 5

### Description
Пользовательское мини-приложение `com.mapphub.themeeditor`. Это не системное приложение: его нет в системном реестре, оно ставится как обычное мини-приложение и хранится в `miniapps/theme-editor/`.
- `mappmanifest.json`: `permissions: ["system.theme.read", "system.theme.write"]`.
- `tokens.js`: чистые функции `parseRootVars(css)` -> список `{ name, value, group }` и `buildRootCss(vars)` -> `:root { ... }`. Без DOM, покрываются node-тестами.
- Группировка по префиксу: `color` -> колорпикер (если значение `#rrggbb`), `radius` -> число с единицей, `font` и остальные -> текст.
- Режим «Сырой CSS»: текстовое поле, синхронизируется с формой.
- Предпросмотр: карточка с кнопками, инпутами, бейджами, стилизованными через `var(--mapp-*)`. Правки применяются локально на контейнер предпросмотра без сохранения.
- Действия: «Сохранить как новую» (`MappHub.theme.save`), «Перезаписать» (только кастомные темы), «Сбросить к заводским» (для `light` и `dark`), «Применить ко всем приложениям» (`MappHub.theme.apply`).
- Подключение: `<link id="mapp-theme-css" href="https://mapp.local/theme.css">` и `<script src="https://mapp.local/MappHub.js">`.

### Files
- `miniapps/theme-editor/index.html`
- `miniapps/theme-editor/mappmanifest.json`
- `miniapps/theme-editor/tokens.js`
- `tests/theme-editor/tokens.test.mjs`

### Acceptance criteria
- `node --test tests/` проходит: round-trip `parseRootVars` -> `buildRootCss` сохраняет имена и значения.
- Значения с `;` или `}` отклоняются при сборке.
- На устройстве редактор открывается и применяет тему только после TASK-016 (монтирование через `miniapp-<id>.local`).

### Depends on
- TASK-011, TASK-012, TASK-013.
