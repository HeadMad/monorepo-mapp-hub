import { test } from "node:test";
import assert from "node:assert/strict";
import { MessageBus, DIALOGS_ID, SHELL_ID } from "../../apps/shell-mobile/www/js/bridge/bus.js";
import { DialogClient } from "../../apps/shell-mobile/www/js/dialogs/client.js";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup() {
  const dialogInbox = [];
  const layouts = [];
  const bus = new MessageBus((sub, message) => {
    if (sub.target.local) sub.target.local(message);
    else dialogInbox.push(message);
    return true;
  });
  bus.subscribe({ appId: DIALOGS_ID, iframe: null }, { type: "dialog.*" });
  const host = {
    targetFrame: async () => ({}),
    setLayout: (mode) => layouts.push(mode),
  };
  const client = new DialogClient({ bus, host });
  const fromDialogs = (type, data) => bus.publish(DIALOGS_ID, { type, data, to: SHELL_ID });
  return { bus, client, dialogInbox, layouts, fromDialogs };
}

test("open отправляет dialog.open только после dialog.ready и переводит слой в overlay", async () => {
  const { client, dialogInbox, layouts, fromDialogs } = setup();
  let changed = null;
  const handle = client.open({
    title: "Тест",
    checkboxes: [{ id: "a", label: "A", checked: true }],
    onChange: (result) => (changed = result),
  });
  assert.deepEqual(layouts, ["overlay"]);
  await tick();
  assert.equal(dialogInbox.length, 0);

  fromDialogs("dialog.ready", {});
  await tick();
  assert.equal(dialogInbox.length, 1);
  const [open] = dialogInbox;
  assert.equal(open.type, "dialog.open");
  assert.equal(open.app, SHELL_ID);
  assert.equal(open.to, DIALOGS_ID);
  assert.equal(open.data.opts.title, "Тест");
  assert.equal(open.data.opts.hasOnChange, true);
  assert.equal(open.data.opts.onChange, undefined);

  fromDialogs("dialog.change", { id: open.data.id, result: { action: null, checked: { a: false }, radios: {} } });
  assert.deepEqual(changed, { action: null, checked: { a: false }, radios: {} });

  fromDialogs("dialog.result", { id: open.data.id, result: { action: "install", checked: { a: true }, radios: {} } });
  assert.deepEqual(await handle.promise, { action: "install", checked: { a: true }, radios: {} });
  assert.equal(layouts.at(-1), "hidden");
});

test("результат от чужого приложения не закрывает диалог", async () => {
  const { bus, client, layouts, fromDialogs } = setup();
  const handle = client.open({ title: "x" });
  fromDialogs("dialog.ready", {});
  await tick();
  const id = [...client.pending.keys()][0];
  bus.publish("com.example.other", { type: "dialog.result", data: { id, result: { action: "x" } }, to: SHELL_ID });
  assert.equal(client.pending.size, 1);
  assert.equal(layouts.at(-1), "overlay");
  fromDialogs("dialog.result", { id, result: { action: "ok" } });
  assert.deepEqual(await handle.promise, { action: "ok" });
});

test("слишком большой patch завершает диалог ошибкой", async () => {
  const { client, fromDialogs } = setup();
  const handle = client.open({ title: "x" });
  fromDialogs("dialog.ready", {});
  await tick();
  handle.update({ message: "x".repeat(20000) });
  const result = await handle.promise;
  assert.equal(result.action, "closed");
  assert.match(result.error, /10 КБ/);
});

test("toast показывает слой toast и возвращает его в hidden по таймеру", async () => {
  const { client, layouts, fromDialogs } = setup();
  const pendingToast = client.toast({ message: "привет", duration: 1 });
  fromDialogs("dialog.ready", {});
  assert.deepEqual(await pendingToast, { shown: true });
  assert.equal(layouts.at(-1), "toast");
  await new Promise((resolve) => setTimeout(resolve, 800));
  assert.equal(layouts.at(-1), "hidden");
});
