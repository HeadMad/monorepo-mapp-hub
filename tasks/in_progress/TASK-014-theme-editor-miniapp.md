# TASK-014: Мини-приложение «Редактор тем»

## Status: In Progress
## Priority: Medium
## Source: tasks/MAPP_ARCHITECTURE_PART2.md, раздел 5

### Description
Пользовательское мини-приложение `com.mapphub.themeeditor`. Это не системное приложение: его нет в системном реестре, оно ставится как обычное мини-приложение и хранится в `miniapps/theme-editor/`.
- `mappmanifest.json`: `permissions: ["system.theme.read", "system.theme.write"]`.
- `tokens.js`: чистые функции без DOM — `parseRootVars(css)` -> `{ name, value, group }[]`, `buildRootCss(vars)`, `validateValue(name, value)`, `setVar`/`removeVar`, `formatLengthPx`/`parseLengthPx`. Отдельно живёт каталог `TOKEN_CATALOG` и сборка модели интерфейса `buildModel(vars)`.
- Каталог токенов разложен по категориям (`TOKEN_CATALOG`, порядок фиксирован): «Цвета», «Скругления», «Отступы и размеры», «Типографика», «Контролы и компоненты». Каждая запись описывает каноничное имя, подпись, тип контрола (`color` / `length` / `text`), значение по умолчанию, границы шага и список алиасов.
- Алиасы: у токенов исторически два имени (`--mapp-color-bg` и `--mapp-bg`). Строка привязывается к тому имени, которое реально есть в теме (`boundName`), поэтому правка не создаёт второй неработающий токен.
- Переменные вне каталога не теряются: `buildModel` собирает их в раздел «Прочее» с контролом по типу значения.
- Интерфейс: категории свёрнуты в спойлеры, состояние раскрытия в `localStorage` (`theme-editor:open-sections`), по умолчанию раскрыты «Цвета». Категория помечается точкой, если в ней есть значение, отличное от значения по умолчанию. Работает поиск по имени, подписи и значению.
- Контролы: цвет — свотч, открывающий нативный `input[type=color]`, плюс поле hex с валидацией `#rrggbb`; размеры — степпер `− / +` с ручным вводом числа; шрифт и прочие значения — текстовое поле.
- Правки сразу применяются к самому редактору (CSS-переменные на `documentElement`), затем попадают в блок «Сырой CSS».
- Превью: карточка с кнопкой, полем ввода, бейджем и вторичным/опасным текстом, стилизованными через `var(--mapp-*)`.
- Действия: «Сохранить» (`MappHub.theme.save`, недоступно на заводских темах), «Копия» (сохранение под новым id), «Сброс» (`MappHub.theme.reset`, только для `light` и `dark`), «Применить» (`MappHub.theme.apply`).
- Подключение: `<link id="mapp-theme-css" href="https://mapp.local/theme.css">` и `<script src="https://mapp.local/MappHub.js">`.

### Released
Выпущено в shell 0.2.0-beta.12 (каталог GitHub Pages, `theme-editor.zip` 0.1.0-beta.5). На устройстве не проверялось.

### Files
- `miniapps/theme-editor/index.html`
- `miniapps/theme-editor/mappmanifest.json`
- `miniapps/theme-editor/tokens.js`
- `tests/theme-editor/tokens.test.mjs`
- `tests/miniapps/inline-scripts.test.mjs`
- `docs/themes.md`

### Acceptance criteria
- `node --test tests/` проходит: round-trip `parseRootVars` -> `buildRootCss` сохраняет имена и значения.
- Значения с `;` или `}` отклоняются при сборке.
- В каталоге нет дубликатов имён и алиасов; `buildModel` не теряет переменные вне каталога.
- Модульный скрипт страницы разбирается парсером (регрессия на смешение `??` и `||`).
- На устройстве редактор открывается и применяет тему только после TASK-016 (монтирование через `miniapp-<id>.local`).

### Depends on
- TASK-011, TASK-012, TASK-013.
