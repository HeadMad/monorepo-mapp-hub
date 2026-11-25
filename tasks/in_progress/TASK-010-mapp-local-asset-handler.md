# TASK-010: Универсальный обработчик mapp.local (MappLocalAssetHandler)

## Status: In Progress
## Priority: High
## Source: tasks/MAPP_ARCHITECTURE_PART2.md, раздел 4

### Description
Java-перехватчик `shouldInterceptRequest` для хоста `mapp.local`. Заменяет прежний `serveShared` в `MappWebViewClient`.
- Статика: `public/assets/{filename.ext}` (исходники в `apps/shell-mobile/www/assets/`).
- Динамика: `public/assets/{filename.ext}.js`. Исполняется в Rhino в интерпретируемом режиме. Синтаксис `export default` перед загрузкой заменяется на `var __mapp_gen =`, поэтому генераторы пишутся в ES5 без import.
- Ограничение времени выполнения генератора (2 секунды) через `ContextFactory.observeInstructionCount`, чтобы не зависнуть в фоновом потоке WebView.
- Кэш `ConcurrentHashMap<String, CachedAsset>` по имени файла. Ключ не учитывает query, поэтому генераторы, зависящие от query, возвращают `cacheable: false`.
- Публичные методы: `invalidateCache(String)`, `invalidateAllCache()`.
- Имя файла проверяется регуляркой `[A-Za-z0-9][A-Za-z0-9._-]*`, без слешей, защита от обхода каталогов.

### Files
- `apps/shell-mobile/native/android/com/mapphub/shell/MappLocalAssetHandler.java`
- `apps/shell-mobile/native/android/com/mapphub/shell/MappWebViewClient.java` (маршрутизация `mapp.local` в новый обработчик)
- `apps/shell-mobile/www/assets/theme.css.js`
- `.github/workflows/build-android.yml` (зависимость `org.mozilla:rhino`)

### Acceptance criteria
- `https://mapp.local/MappHub.js` отдает файл с `Access-Control-Allow-Origin: *`.
- `https://mapp.local/theme.css` возвращает CSS активной темы, при `invalidateCache("theme.css")` содержимое обновляется.
- `https://mapp.local/missing.css` возвращает 404.
- Генератор с бесконечным циклом прерывается и отдает 500 без падения приложения.

### Depends on
- TASK-009.

### Risks
- Rhino на Android не проверен на устройстве. Проверка выполняется на сборке и на устройстве.
