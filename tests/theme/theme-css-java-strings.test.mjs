import test from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// В Android база отдаёт значения через Java-метод DbBridge.getSystemKv. Rhino
// возвращает java.lang.String как обёртку: typeof === "object", а не "string".
// Раньше генератор проверял typeof и всегда отдавал пустой :root {}, поэтому
// смена темы не доходила ни до оболочки, ни до мини-приложений.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const GENERATOR_PATH = join(ROOT, "apps/shell-mobile/www/assets/theme.css.js");

const DARK = `:root {
  --mapp-color-bg: #0f1115;
  --mapp-color-text: #e5e7eb;
}
`;

const generator = (await import(GENERATOR_PATH)).default;

// eslint-disable-next-line no-new-wrappers
const asJavaString = (value) => new String(value);

function javaLikeDb(tables) {
  return {
    getSystemKv(namespace, key) {
      const value = tables[`${namespace}/${key}`];
      return value === undefined || value === null ? null : asJavaString(value);
    },
  };
}

test("значения из базы в виде строковой обёртки читаются как тема", () => {
  const db = javaLikeDb({ "config/active_theme": "dark", "themes/dark": DARK });
  const result = generator({ db, query: {} });
  assert.match(result.body, /active theme dark/);
  assert.match(result.body, /^ {2}--mapp-color-bg: #0f1115;$/m);
  assert.match(result.body, /^ {2}--mapp-color-text: #e5e7eb;$/m);
});

test("строковая обёртка без активной темы даёт встроенную light, а не пустой :root", () => {
  const db = javaLikeDb({ "themes/light": ":root {\n  --mapp-color-bg: #f5f6f8;\n}\n" });
  const result = generator({ db, query: {} });
  assert.match(result.body, /active theme light/);
  assert.match(result.body, /--mapp-color-bg: #f5f6f8;/);
});

test("пустая строка в базе не считается темой", () => {
  const db = javaLikeDb({ "config/active_theme": "dark", "themes/dark": "" });
  const result = generator({ db, query: {} });
  assert.match(result.body, /:root \{\n\}\n$/);
});
