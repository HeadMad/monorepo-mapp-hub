import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseCssVariables } from "../../apps/shell-mobile/www/js/core/cssTokens.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SDK_PATH = join(ROOT, "miniapps/_sdk/MappHub.js");
const BRIDGE_PATH = join(ROOT, "apps/shell-mobile/www/js/bridge/MappHostBridge.js");
const MINIAPPS = join(ROOT, "miniapps");

const CSS = `:root {
  --mapp-color-bg: #f5f6f8;
  --mapp-color-text: #1c1f24;
  --mapp-radius-md: 12px;
  --mapp-font-family: 'Roboto', system-ui, sans-serif;
}
`;

// Разбор обязан совпадать с генератором theme.css: иначе мост отдаёт
// мини-приложению не то, что оболочка читает из того же файла.
const SDK_SOURCE = await readFile(SDK_PATH, "utf8");
const SDK_PARSER_SOURCE = SDK_SOURCE.match(/function parseCssVariables\(css\) \{[\s\S]*?\n  \}/);
const sdkParse = new Function(`${SDK_PARSER_SOURCE[0]}; return parseCssVariables;`)();

test("парсер токенов в SDK и в оболочке дают одинаковый результат", () => {
  const samples = [
    CSS,
    ":root {\n  --mapp-color-bg: #0f1115;\n}\n",
    ":root {\n}\n",
    "",
    null,
    "garbage",
    ":root {\n  broken\n  --mapp-a: 1px\n}\n",
    ":root { --mapp-x: url(evil); --mapp-y: 2px }",
  ];
  for (const sample of samples) {
    assert.deepEqual(sdkParse(sample), parseCssVariables(sample), `разошлись на ${JSON.stringify(sample)}`);
  }
});

test("парсер отдаёт переменные и пропускает мусор", () => {
  const tokens = parseCssVariables(CSS);
  assert.deepEqual(tokens, {
    "--mapp-color-bg": "#f5f6f8",
    "--mapp-color-text": "#1c1f24",
    "--mapp-radius-md": "12px",
    "--mapp-font-family": "'Roboto', system-ui, sans-serif",
  });
});

test("мост отдаёт токены активной темы, а не мёртвый namespace theme/tokens", async () => {
  const bridge = await readFile(BRIDGE_PATH, "utf8");
  assert.doesNotMatch(bridge, /namespace:\s*"theme"/);
  assert.match(bridge, /"ui\.getThemeTokens": async \(\) => \{[\s\S]*themeGetList[\s\S]*themeGetCss/);
  assert.match(bridge, /import \{ parseCssVariables \} from "\.\.\/core\/cssTokens\.js"/);
});

const apps = (await readdir(MINIAPPS, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
  .map((entry) => entry.name);

const pages = [];
for (const app of apps) {
  const html = await readFile(join(MINIAPPS, app, "index.html"), "utf8");
  pages.push({ app, html });
}

test("каждое мини-приложение подключает theme.css", () => {
  for (const { app, html } of pages) {
    assert.match(html, /<link id="mapp-theme-css" rel="stylesheet" href="https:\/\/mapp\.local\/theme\.css">/, `${app}: нет ссылки на theme.css`);
  }
});

test("ссылка на тему стоит в head до собственных стилей", () => {
  for (const { app, html } of pages) {
    const link = html.indexOf('id="mapp-theme-css"');
    const style = html.indexOf("<style>");
    assert.ok(link > 0 && style > link, `${app}: theme.css должен подключаться раньше <style>`);
  }
});

test("у каждого мини-приложения есть слой --app-* с заводскими значениями", () => {
  const required = [
    "--app-bg: var(--mapp-color-bg,",
    "--app-card-bg: var(--mapp-color-surface,",
    "--app-text: var(--mapp-color-text,",
    "--app-text-muted: var(--mapp-color-muted,",
    "--app-primary: var(--mapp-color-primary,",
    "--app-border: var(--mapp-color-border,",
  ];
  for (const { app, html } of pages) {
    if (app === "theme-editor") continue; // у редактора свой слой --te-*
    for (const token of required) {
      assert.ok(html.includes(token), `${app}: нет ${token}`);
    }
  }
});

// Жёстко заданный цвет — это отсутствие темы: проверяем, что в стилях
// остались только заводские значения внутри var(..., #hex).
test("в стилях нет цветов вне var(...)", () => {
  for (const { app, html } of pages) {
    const style = html.match(/<style>([\s\S]*?)<\/style>/);
    assert.ok(style, `${app}: нет <style>`);
    for (const line of style[1].split("\n")) {
      if (!/#[0-9a-fA-F]{3,8}\b/.test(line)) continue;
      assert.ok(line.includes("var("), `${app}: цвет вне var(): ${line.trim()}`);
    }
  }
});

test("SDK обновляет и CSS, и токены при событии themeChanged", async () => {
  assert.match(SDK_SOURCE, /data\.event === "themeChanged"\) \{\s*\n\s*reloadThemeCss\(\);\s*\n\s*refreshThemeTokens\(\);/);
  assert.match(SDK_SOURCE, /if \(window\.parent !== window\) \{\s*\n\s*refreshThemeTokens\(\);/);
});

// var(--x, var(--x)) — переменная ссылается сама на себя: подстановка
// схлопывается в пустоту, элемент теряет цвет. Такой алиас хуже отсутствия алиаса.
test("алиасы не ссылаются сами на себя", async () => {
  for (const { app, html } of pages) {
    const style = html.match(/<style>([\s\S]*?)<\/style>/);
    const selfRef = /var\((--[a-z0-9-]+),\s*var\(\1\)\)/i.exec(style[1]);
    assert.equal(selfRef, null, `${app}: ${selfRef ? selfRef[0] : ""}`);
  }
  for (const file of ["css/tokens.css"]) {
    const source = await readFile(join(ROOT, "apps/shell-mobile/www", file), "utf8");
    assert.equal(/var\((--[a-z0-9-]+),\s*var\(\1\)\)/i.test(source), false, `${file}: самоссылка`);
  }
});
