import { test } from "node:test";
import assert from "node:assert/strict";
import { MessageBus } from "../../apps/shell-mobile/www/js/bridge/bus.js";
import {
  attachBus,
  broadcastEvent,
  deliverToApp,
  invokeBridgeMethod,
  mountMiniApp,
  mountRelayed,
} from "../../apps/shell-mobile/www/js/bridge/MappHostBridge.js";

const BROWSER = "com.mapphub.browser";
const ctxOf = (appId) => ({ appId, permissions: new Set() });

function fakeFrame() {
  const posted = [];
  return { posted, contentWindow: { postMessage: (msg, origin) => posted.push({ msg, origin }) } };
}

test("прямой iframe получает событие с origin своего приложения", () => {
  const iframe = fakeFrame();
  mountMiniApp(iframe, "com.test.direct", []);
  assert.equal(deliverToApp("com.test.direct", "themeChanged", { id: 1 }), true);
  assert.equal(iframe.posted[0].origin, "https://miniapp-com.test.direct.local");
  assert.equal(iframe.posted[0].msg.event, "themeChanged");
});

test("приложение внутри браузера получает событие через релей браузера", () => {
  const host = fakeFrame();
  mountRelayed(host, BROWSER, "com.test.nested");
  assert.equal(deliverToApp("com.test.nested", "bus.message", { subId: "s" }), true);
  assert.equal(host.posted[0].origin, "https://miniapp-com.mapphub.browser.local");
  assert.equal(host.posted[0].msg.appId, "com.test.nested");
  assert.equal(host.posted[0].msg.message.event, "bus.message");
});

test("неизвестное приложение не получает событий", () => {
  assert.equal(deliverToApp("com.test.missing", "x", {}), false);
});

test("broadcast доходит и до прямых, и до релейных приложений", () => {
  const direct = fakeFrame();
  const host = fakeFrame();
  mountMiniApp(direct, "com.test.bcast", []);
  mountRelayed(host, BROWSER, "com.test.bcast_nested");
  broadcastEvent("themeChanged", { id: 2 });
  assert.equal(direct.posted.length, 1);
  assert.equal(host.posted.length, 1);
  assert.equal(host.posted[0].msg.appId, "com.test.bcast_nested");
});

test("подписка из релейного приложения работает без caller и получает сообщения", () => {
  const host = fakeFrame();
  const bus = new MessageBus((sub, message) =>
    deliverToApp(sub.appId, "bus.message", { subId: sub.subId, message }),
  );
  attachBus(bus);
  mountRelayed(host, BROWSER, "com.test.sub");

  const { subId } = invokeBridgeMethod("bus.subscribe", { filter: { type: "weather.*" } }, ctxOf("com.test.sub"));
  invokeBridgeMethod("bus.publish", { type: "weather.updated", data: 21 }, ctxOf("com.test.pub"));
  invokeBridgeMethod("bus.publish", { type: "news.new", data: 1 }, ctxOf("com.test.pub"));

  assert.equal(host.posted.length, 1);
  assert.equal(host.posted[0].msg.message.event, "bus.message");
  assert.equal(host.posted[0].msg.message.payload.subId, subId);
  assert.equal(host.posted[0].msg.message.payload.message.data, 21);
});

test("bus.unsubscribe снимает подписку только у её владельца", () => {
  const bus = new MessageBus((sub, message) => deliverToApp(sub.appId, "bus.message", { message }));
  attachBus(bus);
  const host = fakeFrame();
  mountRelayed(host, BROWSER, "com.test.unsub");
  const { subId } = invokeBridgeMethod("bus.subscribe", {}, ctxOf("com.test.unsub"));
  assert.deepEqual(invokeBridgeMethod("bus.unsubscribe", { subId }, ctxOf("com.test.intruder")), { ok: false });
  assert.deepEqual(invokeBridgeMethod("bus.unsubscribe", { subId }, ctxOf("com.test.unsub")), { ok: true });
});
