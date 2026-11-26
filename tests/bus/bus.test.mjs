import { test } from "node:test";
import assert from "node:assert/strict";
import { MessageBus, BUFFER_SIZE, MAX_DATA_BYTES, CONSOLE_ID } from "../../apps/shell-mobile/www/js/bridge/bus.js";

function setup() {
  const delivered = [];
  const bus = new MessageBus((sub, message) => {
    delivered.push({ appId: sub.appId, subId: sub.subId, message });
    return true;
  });
  return { bus, delivered };
}

const target = (appId) => ({ appId, win: null, iframe: { id: appId } });

test("publish проставляет app и id, data по умолчанию null", () => {
  const { bus } = setup();
  const { id } = bus.publish("com.example.weather", { type: "weather.updated", data: { temp: 21 } });
  assert.match(id, /^[0-9a-f]{8}$/);
  const { replay } = bus.subscribe(target("x"), {}, { replay: true });
  assert.equal(replay[0].app, "com.example.weather");
  assert.equal(replay[0].type, "weather.updated");
  assert.deepEqual(replay[0].data, { temp: 21 });
  assert.equal(replay[0].id, id);
  bus.publish("shell", { type: "shell.ping" });
  assert.equal(bus.buffer.at(-1).data, null);
});

test("фильтр по type и app, пустой фильтр получает всё", () => {
  const { bus, delivered } = setup();
  bus.subscribe(target("all"), {});
  bus.subscribe(target("byType"), { type: "weather.updated" });
  bus.subscribe(target("byApp"), { app: "com.example.weather" });
  bus.subscribe(target("both"), { app: "com.example.weather", type: "weather.updated" });

  bus.publish("com.example.weather", { type: "weather.updated", data: 1 });
  bus.publish("com.example.news", { type: "weather.updated", data: 2 });
  bus.publish("com.example.weather", { type: "news.new", data: 3 });

  const byApp = (appId) => delivered.filter((d) => d.appId === appId).map((d) => d.message.data);
  assert.deepEqual(byApp("all"), [1, 2, 3]);
  assert.deepEqual(byApp("byType"), [1, 2]);
  assert.deepEqual(byApp("byApp"), [1, 3]);
  assert.deepEqual(byApp("both"), [1]);
});

test("префикс type с * совпадает с группой типов", () => {
  const { bus, delivered } = setup();
  bus.subscribe(target("console"), { type: "console.*" });
  bus.publish("app.a", { type: "console.log", data: "a" });
  bus.publish("app.a", { type: "console.error", data: "b" });
  bus.publish("app.a", { type: "console2.log", data: "c" });
  assert.deepEqual(delivered.map((d) => d.message.data), ["a", "b"]);
});

test("сообщение с to видит только адресат", () => {
  const { bus, delivered } = setup();
  bus.subscribe(target("todo"), {});
  bus.subscribe(target("other"), {});
  bus.publish("com.example.shop", { type: "todo.add", data: { title: "молоко" }, to: "todo" });
  assert.deepEqual(delivered.map((d) => d.appId), ["todo"]);
  assert.equal(delivered[0].message.to, "todo");
});

test("replay отдаёт только видимые и подходящие сообщения из буфера", () => {
  const { bus } = setup();
  bus.publish("shell", { type: "console.log", data: "before" });
  bus.publish("com.example.shop", { type: "reply:1", data: "secret", to: "com.example.other" });
  const { replay } = bus.subscribe(target("com.mapphub.console"), { type: "console.*" }, { replay: true });
  assert.deepEqual(replay.map((m) => m.data), ["before"]);
  const none = bus.subscribe(target("x"), {});
  assert.deepEqual(none.replay, []);
});

test("буфер ограничен BUFFER_SIZE", () => {
  const { bus } = setup();
  for (let i = 0; i < BUFFER_SIZE + 10; i++) bus.publish("shell", { type: "console.log", data: i });
  assert.equal(bus.buffer.length, BUFFER_SIZE);
  assert.equal(bus.buffer[0].data, 10);
});

test("data больше 10 КБ отклоняется", () => {
  const { bus } = setup();
  const big = "x".repeat(MAX_DATA_BYTES);
  assert.throws(() => bus.publish("shell", { type: "big", data: big }), (err) => err.code === -32602);
  assert.doesNotThrow(() => bus.publish("shell", { type: "ok", data: "x".repeat(1000) }));
});

test("некорректные type, to и filter отклоняются", () => {
  const { bus } = setup();
  assert.throws(() => bus.publish("shell", { type: "" }), /type/);
  assert.throws(() => bus.publish("shell", { type: 5 }), /type/);
  assert.throws(() => bus.publish("shell", { type: "a", to: "" }), /to/);
  assert.throws(() => bus.subscribe(target("x"), { type: 1 }), /filter\.type/);
});

test("console.* из самой консоли не сохраняется и не доставляется", () => {
  const { bus, delivered } = setup();
  bus.subscribe(target("all"), {});
  bus.publish(CONSOLE_ID, { type: "console.log", data: "loop" });
  assert.equal(delivered.length, 0);
  assert.equal(bus.buffer.length, 0);
});

test("мёртвый подписчик удаляется при доставке", () => {
  const bus = new MessageBus(() => false);
  bus.subscribe(target("x"), {});
  bus.publish("shell", { type: "a" });
  assert.equal(bus.subs.size, 0);
});

test("отписка работает только владельцу, dropFrame снимает подписки фрейма", () => {
  const { bus, delivered } = setup();
  const frame = { id: "main" };
  const { subId } = bus.subscribe({ appId: "a", win: null, iframe: frame }, {});
  assert.equal(bus.unsubscribe(subId, "intruder"), false);
  assert.equal(bus.unsubscribe(subId, "a"), true);

  bus.subscribe({ appId: "b", win: null, iframe: frame }, {});
  bus.subscribe({ appId: "c", win: null, iframe: { id: "other" } }, {});
  bus.dropFrame(frame);
  bus.publish("shell", { type: "a" });
  assert.deepEqual(delivered.map((d) => d.appId), ["c"]);
});
