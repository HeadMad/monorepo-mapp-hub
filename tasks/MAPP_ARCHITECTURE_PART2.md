# Дополнение к ТЗ (Часть 2): Система тем, шина событий SDK и динамические JS-ассеты

## 1. Обзор изменений
Данный документ расширяет базовую архитектуру платформы MiniApps и описывает:
1. Хранение и управление CSS-темами в SQLite (без промежуточного JSON).
2. Расширяемую шину системных событий (`Event Bus`) в `MappHub SDK` и хост-оболочке.
3. Спецификацию мини-приложения **«Редактор тем»** (пользовательское мини-приложение с разрешением `system.theme.write`, не системное).
4. Универсальный нативный обработчик на **Java** для виртуального хоста `https://mapp.local/{filename.ext}` с поддержкой статических файлов и динамических JS-генераторов (`{filename.ext}.js`) с кэшированием.

## 2. Система тем (CSS-хранение и бесшовное применение)

### 2.1. Структура хранения в SQLite (`system_kv`)
Темы хранятся в готовом к отдаче CSS-формате (валидный CSS с блоком `:root { --var: value; }`), что исключает затраты на парсинг и сборку строк.
- **Пресеты тем**: `namespace = 'themes'`, `key = '<theme_id>'` (например: `light`, `dark`, `custom_1`), `value = '<готовая CSS-строка>'`.
- **Активная тема**: `namespace = 'config'`, `key = 'active_theme'`, `value = '<theme_id>'`.
- **Инициализация**: при первом запуске приложения в `MappDatabaseHelper.onCreate(SQLiteDatabase db)` в базу записываются две дефолтные темы (`light` и `dark`), активной устанавливается `light`.

### 2.2. API управления темами (Хост-оболочка и разрешения)
Методы доступны в `MappSystemPlugin.java` и проксируются через мост для мини-приложений, обладающих соответствующим разрешением (например, `system.theme.write`):
- `theme.getList()` — возвращает список доступных тем (`id`, метаданные/название) и `activeThemeId`.
- `theme.getCss(themeId)` — возвращает сырую CSS-строку конкретной темы (для загрузки в редактор).
- `theme.save(themeId, cssString)` — сохраняет новую или обновляет существующую тему в `system_kv`. Если обновляется текущая активная тема, автоматически сбрасывается кэш `theme.css` и рассылается событие `themeChanged`.
- `theme.apply(themeId)` — устанавливает `active_theme = themeId`, сбрасывает кэш `theme.css` в памяти и инициирует широковещательную рассылку события `themeChanged` во все открытые `iframe` и в саму оболочку.

### 2.3. Бесшовная перезагрузка стилей на клиенте (`sdk.js`)
В `<head>` мини-приложений тема подключается тегом:
```html
<link id="mapp-theme-css" rel="stylesheet" href="https://mapp.local/theme.css">
```
При получении события `themeChanged` от оболочки SDK выполняет подмену тега по принципу Double Buffering (без мерцания экрана):
1. Создает новый `<link rel="stylesheet" href="https://mapp.local/theme.css?v=<timestamp>">`.
2. Вставляет его в `<head>` сразу **после** текущего `#mapp-theme-css` (новые правила переопределяют старые по каскаду).
3. В колбэке `newLink.onload` удаляет старый тег `<link>` и присваивает новому `id="mapp-theme-css"`.

## 3. Расширяемая шина событий (`MappHub` Event Bus)

### 3.1. Протокол сообщений (Хост -> Iframe)
Унифицировать формат системных событий, отправляемых родительским окном в активные `iframe` через `postMessage`:
```json
{
  "__mapp_event__": true,
  "event": "themeChanged",
  "payload": { "themeId": "custom_1" },
  "timestamp": 1795729440000
}
```

### 3.2. Публичный API подписки в `sdk.js`
Добавить в `window.MappHub` универсальный механизм подписки на системные события (аналог `EventEmitter`):
- `MappHub.events.on(eventName, callback)` — подписка на событие (возвращает функцию отписки `unsubscribe`).
- `MappHub.events.off(eventName, callback)` — отписка от события.
- `MappHub.events.once(eventName, callback)` — одноразовая подписка.
- Внутренний системный слушатель внутри `sdk.js` сам подписывается на `themeChanged` для автоматического вызова `reloadThemeCss()`.

## 4. Универсальный обработчик `https://mapp.local/{filename.ext}` (Java)

### 4.1. Архитектура нативного адаптера (`MappLocalAssetHandler.java`)
Единый Java-перехватчик в `shouldInterceptRequest` обслуживает все запросы к хосту `mapp.local`. Исходники ассетов: `www/assets/` в репозитории, в APK они попадают в `assets/public/assets/` (Capacitor копирует `webDir` в `public/`).

**Алгоритм разрешения запроса `https://mapp.local/{filename.ext}`:**
1. **Проверка In-Memory кэша**: потокобезопасный `ConcurrentHashMap<String, CachedAsset>`. Если для `{filename.ext}` есть актуальный кэш — немедленно вернуть `WebResourceResponse` из него.
2. **Поиск статического файла**: `AssetManager.open("public/assets/{filename.ext}")`. Если найден — отдать поток с MIME-типом по расширению и заголовком `Access-Control-Allow-Origin: *`.
3. **Поиск динамического JS-генератора**: если статики нет, проверить `public/assets/{filename.ext}.js` (для `theme.css` — `theme.css.js`).
   - Выполнить в Rhino (интерпретируемый режим, `optimizationLevel = -1`) с объектом `ctx`: `ctx.db.getSystemKv(namespace, key)` и `ctx.query` (параметры запроса).
   - Вызвать экспортируемый обработчик. Результат `{ body, mimeType, cacheable }` обернуть в `WebResourceResponse` с заголовками `Access-Control-Allow-Origin: *` и `Cache-Control: no-store, no-cache, must-revalidate`.
   - Если `cacheable == true` — сохранить в `ConcurrentHashMap`.
4. **404**: если ни статики, ни генератора нет — вернуть ответ со статусом `404`.

### 4.2. Инвалидация кэша динамических ассетов
- `MappLocalAssetHandler`: методы `invalidateCache(String filename)` и `invalidateAllCache()`.
- `themeSave` / `themeApply` в `MappSystemPlugin.java` вызывают `invalidateCache("theme.css")`.
- `@PluginMethod invalidateAssetCache(PluginCall call)` в `MappSystemPlugin.java` — сброс кэша любых динамических файлов из JS оболочки.

### 4.3. Пример динамического ассета `www/assets/theme.css.js`
```javascript
// Файл: www/assets/theme.css.js
// Вызывается нативным адаптером при запросе https://mapp.local/theme.css

export default function(ctx) {
  var activeThemeId = ctx.db.getSystemKv('config', 'active_theme') || 'light';
  var cssContent = ctx.db.getSystemKv('themes', activeThemeId) || ':root {}';

  return {
    body: cssContent,
    mimeType: 'text/css',
    cacheable: true
  };
}
```

## 5. Спецификация мини-приложения «Редактор тем» (Theme Editor)

Пользовательское мини-приложение (не системное) `com.mapphub.themeeditor`, поставляемое в APK и запрашивающее разрешения `system.theme.read` и `system.theme.write` в `mappmanifest.json`.

### 5.1. Функциональные требования
1. **Выбор базовой темы**: загрузка списка через `MappHub.theme.getList()` и выбор любой темы (`light`, `dark` или кастомной) как шаблона.
2. **Парсинг и визуальное редактирование токенов**:
   - Сырой CSS выбранной темы через `MappHub.theme.getCss(themeId)`.
   - Парсинг CSS-переменных (`--mapp-*`) из `:root` в поля с группировкой по префиксам (`--mapp-color-*` -> колорпикер, `--mapp-radius-*` -> числовое поле, `--mapp-font-*` -> текстовое поле).
   - Режим «Сырой CSS» для ручной правки.
3. **Live-предпросмотр**: карточка с типовыми UI-элементами, стилизованными через `--mapp-*`; изменения применяются локально без сохранения в БД.
4. **Сохранение и глобальное применение**:
   - Сборка переменных обратно в `:root { ... }`.
   - **«Сохранить как новую»** (`MappHub.theme.save(newId, css)`) или **«Перезаписать»** (только кастомные темы). Базовые `light` и `dark` защищены от перезаписи, для них доступна кнопка **«Сбросить к заводским»**.
   - **«Применить ко всем приложениям»** -> `MappHub.theme.apply(themeId)`.

## 6. План внедрения
1. **Нативный слой (Java)**:
   - Темы в `MappDatabaseHelper.java`, сидирование `light` и `dark`.
   - `MappLocalAssetHandler.java` с статикой, генераторами `{filename.ext}.js` и кэшем с инвалидацией.
   - Подключение `MappLocalAssetHandler` в `shouldInterceptRequest` для `mapp.local`.
   - Методы `themeGetList`, `themeGetCss`, `themeSave`, `themeApply`, `invalidateAssetCache` в `MappSystemPlugin.java`.
2. **JS-мост и SDK**:
   - `MappHostBridge.js`: проксирование `theme.*` с проверкой разрешений и рассылка `broadcastEvent` во все `iframe`.
   - `sdk.js`: `MappHub.events`, `reloadThemeCss` с Double Buffering, `MappHub.theme.*`.
