import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const GENERATOR_PATH = join(ROOT, "apps/shell-mobile/www/assets/theme.css.js");
const INDEX_PATH = join(ROOT, "apps/shell-mobile/www/index.html");
const TOKENS_PATH = join(ROOT, "apps/shell-mobile/www/css/tokens.css");

const LIGHT = `:root {
  --mapp-color-bg: #f5f6f8;
  --mapp-color-text: #1c1f24;
}
`;
const DARK = `:root {
  --mapp-color-bg: #0f1115;
  --mapp-color-surface: #181b22;
  --mapp-radius-md: 12px;
}
`;

const generator = (await import(GENERATOR_PATH)).default;
const source = await readFile(GENERATOR_PATH, "utf8");

function dbWith(tables) {
  const calls = [];
  return {
    calls,
    getSystemKv(namespace, key) {
      calls.push([namespace, key]);
      const value = tables[`${namespace}/${key}`];
      return value === undefined ? null : value;
    },
  };
}

function render(tables) {
  const db = dbWith(tables);
  return { db, result: generator({ db, query: {} }) };
}

test("генератор отдаёт CSS активной темы", () => {
  const { result } = render({ "config/active_theme": "dark", "themes/dark": DARK });
  assert.equal(result.mimeType, "text/css");
  assert.equal(result.cacheable, false);
  assert.match(result.body, /^\/\* theme\.css: active theme dark \*\/\n:root \{\n/);
  assert.match(result.body, /^ {2}--mapp-color-bg: #0f1115;$/m);
  assert.match(result.body, /^ {2}--mapp-radius-md: 12px;$/m);
  assert.match(result.body, /\}\n$/);
});

test("без активной темы берётся встроенная light", () => {
  const { db, result } = render({ "themes/light": LIGHT });
  assert.deepEqual(db.calls[0], ["config", "active_theme"]);
  assert.match(result.body, /--mapp-color-bg: #f5f6f8;/);
  assert.match(result.body, /active theme light/);
});

test("некорректный идентификатор темы не попадает в запрос к базе", () => {
  const { db, result } = render({
    "config/active_theme": "../etc/passwd",
    "themes/light": LIGHT,
  });
  assert.ok(!db.calls.some(([, key]) => key.includes("passwd")));
  assert.match(result.body, /--mapp-color-bg: #f5f6f8;/);
});

test("неизвестная тема отдаёт пустой :root вместо ошибки", () => {
  const { result } = render({ "config/active_theme": "custom", "themes/custom": null });
  assert.equal(result.body, "/* theme.css: active theme custom */\n:root {\n}\n");
});

test("опасные и битые объявления отбрасываются", () => {
  const css = `:root {
  --mapp-color-bg: url(https://evil.example/x.png);
  --mapp-color-text: #fff;
  --broken: {color: red};
  --empty: ;
  not-a-var: 1px;
  --mapp-radius-sm: 6px;
}
`;
  const { result } = render({ "config/active_theme": "custom", "themes/custom": css });
  assert.doesNotMatch(result.body, /url\(/);
  assert.doesNotMatch(result.body, /\{color/);
  assert.doesNotMatch(result.body, /not-a-var/);
  assert.match(result.body, /--mapp-color-text: #fff;/);
  assert.match(result.body, /--mapp-radius-sm: 6px;/);
});

test("ошибка чтения базы не превращается в 500", () => {
  const db = {
    getSystemKv() {
      throw new Error("db is locked");
    },
  };
  const result = generator({ db, query: {} });
  assert.equal(result.body, "/* theme.css: active theme light */\n:root {\n}\n");
});

test("слишком большой CSS обрезается, но остаётся валидным", () => {
  const padding = "--mapp-filler-" + "x".repeat(64) + ": 1px;\n";
  const css = ":root {\n--mapp-color-bg: #000;\n" + padding.repeat(400) + "}\n";
  const { result } = render({ "config/active_theme": "custom", "themes/custom": css });
  assert.ok(result.body.length < 24 * 1024);
  assert.match(result.body, /--mapp-color-bg: #000;/);
  assert.match(result.body, /\}\n$/);
});

test("генератор совместим с Rhino: только ES5-синтаксис", () => {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(code, /=>/, "стрелочные функции");
  assert.doesNotMatch(code, /\b(?:let|const)\s+[A-Za-z_$]/, "let/const");
  assert.doesNotMatch(code, /`/, "шаблонные строки");
  assert.doesNotMatch(code, /\.\.\./, "spread");
  assert.doesNotMatch(code, /\bclass\s+[A-Za-z_$]/, "классы");
  assert.doesNotMatch(code, /\?\./, "optional chaining");
  assert.doesNotMatch(code, /\?\?/, "nullish coalescing");
});

test("сгенерированный CSS читается после переписывания как в MappLocalAssetHandler", () => {
  // Нативный слой делает ровно это: source.replaceFirst("(?m)^\\s*export\\s+default\\s+", "var __mapp_gen = ")
  // и вызывает __mapp_gen(ctx). Здесь проверяем, что после такого переписывания
  // скрипт всё ещё исполняется в обычном нестрогом контексте без import/export.
  const rewritten = source.replace(/^\s*export\s+default\s+/m, "var __mapp_gen = ");
  const run = new Function(`${rewritten}\nreturn __mapp_gen;`);
  const entry = run();
  const db = dbWith({ "config/active_theme": "dark", "themes/dark": DARK });
  const result = entry({ db, query: {} });
  assert.match(result.body, /--mapp-color-surface: #181b22;/);
  assert.equal(result.mimeType, "text/css");
});

test("MappLocalAssetHandler находит точку входа генератора", () => {
  // Нативный слой переписывает первое вхождение export default в начале строки
  // в `var __mapp_gen = `, поэтому объявление должно стоять отдельной строкой.
  assert.match(source, /^export default function \(ctx\) \{$/m);
});

test("оболочка подключает theme.css с идентификатором для перезагрузки", async () => {
  const html = await readFile(INDEX_PATH, "utf8");
  assert.match(html, /<link id="mapp-theme-css" rel="stylesheet" href="https:\/\/mapp\.local\/theme\.css">/);
  assert.ok(
    html.indexOf("mapp-theme-css") < html.indexOf("css/tokens.css"),
    "theme.css должен подключаться до tokens.css",
  );
});

test("токены оболочки — алиасы на --mapp-* с запасным значением", async () => {
  const css = await readFile(TOKENS_PATH, "utf8");
  const aliases = [...css.matchAll(/--app-[a-z-]+:\s*var\((--mapp-[a-z-]+),\s*[^)]+\);/g)];
  assert.equal(aliases.length, 9, "все токены оболочки должны быть алиасами");
  assert.ok(aliases.some(([, mapp]) => mapp === "--mapp-color-bg"));
  assert.ok(aliases.some(([, mapp]) => mapp === "--mapp-radius-md"));
  assert.doesNotMatch(css, /^\s*--app-[a-z-]+:\s*#[0-9a-f]{3,8};/m, "жёстко заданных цветов быть не должно");
});
