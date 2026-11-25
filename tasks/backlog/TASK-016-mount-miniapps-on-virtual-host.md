# TASK-016: Монтирование мини-приложений на виртуальный домен miniapp-<id>.local

## Status: Backlog
## Priority: High

### Description
Сейчас встроенные мини-приложения (`launcher`, `sample-game`) грузятся как `miniapps/<name>/index.html` с origin оболочки. Новая схема из ТЗ Части 1 требует, чтобы каждое установленное мини-приложение работало на `https://miniapp-<id>.local/`:
- `runtime.js` берет `entry_point` и `active_version` из `system_registry` и открывает iframe по виртуальному домену.
- При установке из APK пакет распаковывается в `noBackupFilesDir` через `MappPackageManager` (TASK-документ Части 1).
- `MappHostBridge` видит корректный origin и отвечает.

Без этой задачи TASK-013 и TASK-014 работают только в тестах, а на устройстве редактор тем и мост с темами не работают.

Также сюда относится миграция `launcher` и `sample-game` на новый `sdk.js` и удаление старого `mapp-bridge.js`.

### Depends on
- TASK-009..TASK-014.
