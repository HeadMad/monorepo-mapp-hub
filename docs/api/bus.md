# Общий канал событий (bus)

Статус: **предложение, не реализовано**. Этот документ фиксирует API, который нужно согласовать до реализации (см. [TASK-017](../../tasks/backlog/TASK-017-shared-event-bus.md)).

Общее пространство, через которое мини-приложения и оболочка публикуют сообщения, а остальные подписываются на нужные им сообщения. Консоль (см. [TASK-018](../../tasks/backlog/TASK-018-console-as-miniapp.md)) — первый потребитель шины.

## Модель сообщения

```js
{
  type: "weather.updated",   // строка, обязательна: тип события или адрес
  data: { temp: 21 },        // любой JSON-сериализуемый объект, обязателен
  app:  "com.example.weather", // отправитель, проставляет оболочка
  id:   "k3f9a2b1"           // короткий хэш, генерирует оболочка
}
```

- `app` проставляет оболочка по `event.source` фрейма, приложение не может подделать отправителя. Для сообщений оболочки `app = "shell"`.
- `id` генерирует оболочка. Нужен, чтобы отправитель мог подписаться на ответ (см. «Запрос-ответ»).

## Типы сообщений

| Вид | Пример `type` | Кто получает |
|---|---|---|
| Широковещательный | `weather.updated`, `console.log`, `shell.miniappOpened` | Все подписчики, чей фильтр подходит |
| Адресный | `to:com.example.todo/add` | Подписчики, у которых фильтр `type` покрывает `to:com.example.todo/*` |
| Ответ на сообщение | `reply:<id>` | Отправитель исходного сообщения, подписанный на `reply:<id>` |

Адресат указывается в самом типе: `to:<appId>/<действие>`. Получатель подписывается на `to:<свой appId>/*`.

## Подписки

Фильтр необязательный. Поля комбинируются по «И»:

| Поле фильтра | Значение | Пример |
|---|---|---|
| `type` | точный тип или префикс с `*` на конце | `"console.*"`, `"weather.updated"` |
| `app` | точный appId отправителя | `"com.example.weather"` |

- Без фильтра (`{}`) приходят все сообщения.
- Фильтр проверяет оболочка, в приложение доставляются только подходящие сообщения.
- `subscribe` возвращает функцию отписки.

## API в SDK

```js
MappHub.bus.publish(type, data)          // → Promise<{ id }>
MappHub.bus.subscribe(filter, handler)   // → отписка (функция)
MappHub.bus.request(type, data, { timeout })  // → Promise<reply-сообщение>
```

`request` — надстройка над `publish` и `subscribe`: публикует сообщение, подписывается на `reply:<id>` и возвращает первый ответ или ошибку по таймауту.

## Пример взаимодействия

### 1. Консоль как миниприложение: лог от приложения до экрана

```js
// Консоль (com.mapphub.console, service: true), запущена как dock
MappHub.bus.subscribe({ type: "console.*" }, (msg) => {
  appendRow(msg.app, msg.type, msg.data.text);
});
```

```js
// Любое приложение. MappHub.js переопределяет console.* и публикует сам:
console.log("tick", 42);
// эквивалент:
await MappHub.bus.publish("console.log", { text: "tick 42" });
// в шине: { type: "console.log", data: { text: "tick 42" }, app: "com.example.game", id: "a1b2c3d4" }
```

### 2. Фильтры подписки

```js
MappHub.bus.subscribe({}, handler);                                   // все события
MappHub.bus.subscribe({ app: "com.example.weather" }, handler);       // все события одного приложения
MappHub.bus.subscribe({ type: "weather.updated" }, handler);          // один тип от всех
MappHub.bus.subscribe({ app: "com.example.weather", type: "weather.updated" }, handler);
```

### 3. Адресное сообщение

```js
// Отправитель: com.example.shop
await MappHub.bus.publish("to:com.example.todo/add", { title: "Купить молоко" });

// Получатель: com.example.todo
MappHub.bus.subscribe({ type: "to:com.example.todo/*" }, (msg) => {
  // msg.type === "to:com.example.todo/add", msg.app === "com.example.shop"
  addTask(msg.data.title);
});
```

### 4. Запрос-ответ

```js
// Отправитель: com.example.shop
const reply = await MappHub.bus.request("to:com.example.todo/list", {}, { timeout: 3000 });
// reply.type === "reply:<id исходного сообщения>", reply.data.items

// Получатель: com.example.todo
MappHub.bus.subscribe({ type: "to:com.example.todo/list" }, (msg) => {
  MappHub.bus.publish(`reply:${msg.id}`, { items: getTasks() });
});
```

Порядок доставки: оболочка сначала отвечает на `publish` (с `id`), потом доставляет сообщение получателям. Поэтому подписка на `reply:<id>`, оформленная после ответа на `publish`, успевает принять ответ.

### 5. Сообщения оболочки

```js
// Оболочка публикует от своего имени: app === "shell"
publish("shell.miniappOpened", { appId: "com.example.todo" });
```

## Как работает внутри

- SDK (`miniapps/_sdk/MappHub.js`) отправляет `bus.publish` и `bus.subscribe` через обычный RPC в оболочку.
- Оболочка (`runtime.js`) хранит подписки по фрейму, проставляет `app` и `id`, фильтрует и доставляет сообщения через `__mapp_event__` с событием `bus`.
- Фильтрация в оболочке, а не в каждом фрейме, чтобы не гонять лишний трафик.

## Открытые вопросы

1. **История (replay).** Консоль запускается по требованию, поэтому логи, созданные до её запуска, без буфера теряются. Предложение: оболочка хранит последние 500 сообщений и отдаёт их при `subscribe({ ..., replay: true })`.
2. **Приватность.** Подписка без фильтра `app` видит данные всех приложений. Предложение: подписка на чужие сообщения без `app` требует разрешения (например, `bus.subscribeAll`), а консоль получает его явно.
3. **Права на публикацию.** Нужно ли разрешение `bus.publish`, или публикация доступна всем приложениям.
4. **Лимит размера `data`.** Предложение: 10 КБ, как `MAX_TEXT` в `console.write`.
5. **Петля консоли.** Приложение консоли не должно публиковать собственные `console.*`, иначе появится бесконечный цикл. Предложение: MappHub.js не перехватывает `console` в `com.mapphub.console`.
6. **Судьба `console.write`.** После переноса консоли метод становится лишним. Предложение: оставить как алиас на `bus.publish("console.log", ...)` на время перехода, потом удалить.

Назад: [справочник API](README.md)
