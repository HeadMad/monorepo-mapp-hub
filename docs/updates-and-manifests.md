# Автообновление оболочки и манифесты

Назад: [документация](README.md) · API: [api/README.md](api/README.md) · Разрешения: [permissions.md](permissions.md)

## 1. Обновление оболочки и бета-канал
- При запуске оболочка читает `release-manifest.json` (адрес в `apps/shell-mobile/www/shell-config.json`).
- Сравнивает версию с текущей. Если доступна новая, показывает модальное окно. Бета-версии предлагаются только при включенной галочке «Устанавливать бета-версии».
- Установка идет поверх старой версии без потери данных. Экшен: [shell.checkUpdate](api/shell.checkUpdate.md).
- Установка APK пока не реализована: [TASK-004](../tasks/backlog/TASK-004-shell-auto-update-seamless.md).

## 2. Манифест мини-приложения (`mappmanifest.json`)
Формат и правила полей описаны в [руководстве разработчика](miniapp-development.md#3-манифест-mappmanifestjson).

Пример:
```json
{
  "id": "com.mapphub.samplegame",
  "name": "Sample HTML5 Game",
  "version": "0.1.0-beta.1",
  "permissions": ["device.info", "notifications.alert", "storage.get"],
  "archiveUrl": "https://example.com/miniapps/sample-game.zip"
}
```

Версии и `archiveUrl` в текущих манифестах в репозитории пока заглушки: архивы мини-приложений еще не публикуются.

## 3. Обновление мини-приложения
- Мини-приложение само решает, как проверять обновления. Например, кнопка, которая загружает свой удаленный `mappmanifest.json` и сравнивает `version`.
- Маркет мини-приложений может читать те же манифесты и оповещать пользователя о доступных обновлениях.
- Установка новой версии: [miniapp.install](api/miniapp.install.md).

## 4. Экшены
- [shell.checkUpdate](api/shell.checkUpdate.md)
- [miniapp.install](api/miniapp.install.md)
