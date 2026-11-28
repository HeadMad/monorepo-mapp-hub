import test from "node:test";
import assert from "node:assert/strict";

// Минимальная заглушка DOM: модуль трогает только document.head,
// document.getElementById, document.createElement и window.addEventListener.
function installDom() {
  const head = {
    children: [],
    appendChild(node) {
      node.parentNode = head;
      head.children.push(node);
      return node;
    },
    removeChild(node) {
      head.children = head.children.filter((child) => child !== node);
      node.parentNode = null;
      return node;
    },
  };
  const document = {
    head,
    getElementById(id) {
      return head.children.find((child) => child.id === id) || null;
    },
    createElement(tag) {
      const node = {
        tag,
        id: "",
        rel: "",
        href: "",
        parentNode: null,
        listeners: {},
        addEventListener(type, callback) {
          node.listeners[type] = callback;
        },
        remove() {
          if (node.parentNode) node.parentNode.removeChild(node);
        },
      };
      return node;
    },
  };
  const listeners = {};
  const window = {
    addEventListener(type, callback) {
      (listeners[type] ||= []).push(callback);
    },
    dispatch(type, detail) {
      for (const callback of listeners[type] || []) callback({ detail });
    },
  };
  globalThis.document = document;
  globalThis.window = window;
  // Как в index.html: стартовая ссылка с id уже стоит в <head>.
  const initial = document.createElement("link");
  initial.id = "mapp-theme-css";
  initial.rel = "stylesheet";
  initial.href = "https://mapp.local/theme.css";
  head.appendChild(initial);
  return { head, window };
}

const { head, window } = installDom();
const { reloadThemeCss, startThemeCss } = await import(
  "../../apps/shell-mobile/www/js/bridge/themeCss.js"
);

function firstLink() {
  const link = head.children[0];
  link.id = "mapp-theme-css";
  return link;
}

test("стартовая ссылка остаётся, пока новая не загрузилась", () => {
  const original = firstLink();
  const next = reloadThemeCss();
  assert.equal(head.children.length, 2);
  assert.equal(head.children[0], original);
  assert.equal(next.href.startsWith("https://mapp.local/theme.css?v="), true);
  assert.equal(next.id, "");
});

test("после onload старая ссылка убирается, новая получает id", () => {
  const [original, next] = head.children;
  next.listeners.load();
  assert.equal(head.children.length, 1);
  assert.equal(head.children[0], next);
  assert.equal(next.id, "mapp-theme-css");
  assert.equal(head.children.includes(original), false);
});

test("при ошибке загрузки старая ссылка выживает", () => {
  const current = head.children[0];
  const failed = reloadThemeCss();
  failed.listeners.error();
  assert.equal(head.children.length, 1);
  assert.equal(head.children[0], current);
  assert.equal(current.id, "mapp-theme-css");
});

test("themeChanged запускает перезагрузку, прочие события — нет", () => {
  startThemeCss();
  const before = head.children.length;
  window.dispatch("mapp:event", { event: "console.log", payload: {} });
  assert.equal(head.children.length, before);

  window.dispatch("mapp:event", { event: "themeChanged", payload: { themeId: "dark" } });
  assert.equal(head.children.length, before + 1);
});
