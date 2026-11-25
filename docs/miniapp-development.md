# Руководство по разработке мини-приложений

Мини-приложение это обычная HTML5-страница (один `index.html` или несколько файлов), которая запускается в iframe оболочки и общается с ней через мост `MappHub`.

## 1. Где взять мост

Файл: [`miniapps/_sdk/MappHub.js`](../miniapps/_sdk/MappHub.js). Репозиторий публичный, скачать можно по прямой ссылке:

```
https://raw.githubusercontent.com/HeadMad/monorepo-mapp-hub/main/miniapps/_sdk/MappHub.js
```

Рекомендуемый способ: скопировать файл в свой проект как `_sdk/MappHub.js` и подключать локально. Так мини-приложение работает без сети и не зависит от изменений в репозитории.

Подключение классическим скриптом, до своего кода:

```html
<script src="_sdk/MappHub.js"></script>
<script>
  (async () => {
    const res = await MappHub.call("device.info");
    if (res.ok) console.log(res.result);
    else console.error(res.message);
  })();
</script>
```

Мост создает глобальный объект `MappHub`. Больше ничего подключать не нужно.

## 2. Как вызывать API

```js
const res = await MappHub.<category>("<action>", { ...params });
```

- `category.action` это имя экшена из [справочника API](api/README.md).
- Параметры передаются одним объектом. Если параметров нет, второй аргумент можно не передавать.
- Ответ всегда имеет вид `{ ok: true, result }` или `{ ok: false, message }`. Исключения не выбрасываются, проверяйте `ok`.

Пример с хранилищем:
```js
const saved = await MappHub.storage("get", { key: "best-score" });
if (saved.ok && saved.result.value !== null) {
  console.log("Рекорд:", saved.result.value);
}
```

## 3. Манифест `mappmanifest.json`

Каждое мини-приложение кладет манифест в корень своей папки:

```json
{
  "id": "com.example.myapp",
  "name": "Моя игра",
  "version": "0.1.0-beta.1",
  "permissions": ["device.info"],
  "archiveUrl": "https://example.com/myapp-0.1.0-beta.1.zip"
}
```

| Поле | Обязательно | Описание |
|---|---|---|
| `id` | да | Уникальный идентификатор (reverse-DNS) |
| `name` | да | Название для пользователя |
| `version` | да | Версия в формате semver, например `1.2.0` или `0.1.0-beta.2` |
| `permissions` | нет | Список разрешений, которые нужны приложению. Правила: [permissions.md](permissions.md) |
| `archiveUrl` | нет | Адрес архива новой версии |

Структура манифеста и обновления описаны в [updates-and-manifests.md](updates-and-manifests.md).

## 4. Разрешения

- Экшены песочницы (`notifications.alert`, `shell.checkUpdate`, `storage.get` после изоляции) разрешений не требуют.
- Если приложению нужен `device.info`, его надо указать в `permissions`. Иначе экшен должен вернуть ошибку.
- Полный список классов и предложенных разрешений: [permissions.md](permissions.md).

## 5. Пример: проверка обновлений оболочки

```js
const res = await MappHub.call("shell.checkUpdate", { includeBeta: false });
if (res.ok && res.result.hasUpdate) {
  console.log("Доступна версия", res.result.targetVersion);
}
```

## 6. Ограничения песочницы

- Мини-приложение работает в `iframe` с `sandbox="allow-scripts allow-same-origin allow-forms"`.
- Прямого доступа к DOM оболочки нет. Все системные окна и уведомления идут через `notifications.alert` и модальное окно оболочки.
- Пути в `shell.navigate` задаются от корня `www`, например `miniapps/launcher/index.html`. См. [shell.navigate](api/shell.navigate.md).

## 7. Что дальше

- Протокол мини-приложение <-> оболочка: [rpc-protocol.md](rpc-protocol.md).
- Примеры: `miniapps/launcher` (лаунчер), `miniapps/sample-game` (демо со всеми вызовами).
- Задачи и планы: [tasks/](../tasks/).
