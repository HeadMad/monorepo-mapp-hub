# TASK-005: Сборка Android APK и релиз через GitHub Actions

## Status: In Progress
## Priority: High

Сборка выполняется workflow `Build Android Shell APK` (`.github/workflows/build-android.yml`), запуск вручную (`workflow_dispatch`).

- Вход: `version` без префикса `v` (X.Y.Z или X.Y.Z-beta.N), `prerelease`, необязательный `release_notes`.
- `versionCode` вычисляется из `version`.
- Если `release_notes` пустой, описание берётся из `docs/releases/v<версия>.md`. Без файла релиз не публикуется.
- Результат: GitHub Release `v<версия>` с подписанным APK и `dist/miniapps/*`.

Что workflow не делает:
- не обновляет `release-manifest.json` и каталог GitHub Pages (ветка `gh-pages`) — это делается вручную после успешной сборки;
- не проверяет APK на устройстве.

Подписывание требует секреты репозитория `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
