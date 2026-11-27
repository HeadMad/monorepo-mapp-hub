import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseRootVars, buildRootCss, groupOf, isHexColor,
  TOKEN_CATALOG, buildModel, boundName, setVar, removeVar,
  formatLengthPx, parseLengthPx, missingDefaults,
} from "../../miniapps/theme-editor/tokens.js";

const SAMPLE = `:root {
  --mapp-color-bg: #f5f6f8;
  --mapp-color-text: #1c1f24;
  --mapp-radius-md: 12px;
  --mapp-font-family: 'Roboto', system-ui, sans-serif;
}
`;

test("parseRootVars читает имена, значения и группы", () => {
  const vars = parseRootVars(SAMPLE);
  assert.deepEqual(vars.map((v) => v.name), [
    "--mapp-color-bg",
    "--mapp-color-text",
    "--mapp-radius-md",
    "--mapp-font-family",
  ]);
  assert.equal(vars[0].value, "#f5f6f8");
  assert.equal(vars[0].group, "color");
  assert.equal(vars[2].group, "radius");
  assert.equal(vars[3].group, "text");
});

test("round-trip parseRootVars -> buildRootCss сохраняет имена и значения", () => {
  const first = parseRootVars(SAMPLE);
  const rebuilt = buildRootCss(first);
  const second = parseRootVars(rebuilt);
  assert.deepEqual(second.map(({ name, value }) => ({ name, value })),
    first.map(({ name, value }) => ({ name, value })));
});

test("buildRootCss отклоняет значения с ; и }", () => {
  assert.throws(() => buildRootCss([{ name: "--a", value: "red; --b: blue" }]));
  assert.throws(() => buildRootCss([{ name: "--a", value: "red}" }]));
});

test("buildRootCss отклоняет url( и @import", () => {
  assert.throws(() => buildRootCss([{ name: "--a", value: "url(https://x.test/a.png)" }]));
  assert.throws(() => buildRootCss([{ name: "--a", value: "@import" }]));
});

test("parseRootVars требует блок :root", () => {
  assert.throws(() => parseRootVars("body { color: red; }"));
});

test("buildRootCss отклоняет некорректные имена переменных", () => {
  assert.throws(() => buildRootCss([{ name: "color", value: "red" }]));
});

test("groupOf и isHexColor", () => {
  assert.equal(groupOf("--mapp-font-size-base"), "text");
  assert.equal(isHexColor("#1C1f24"), true);
  assert.equal(isHexColor("12px"), false);
});

test("TOKEN_CATALOG: категории в стабильном порядке, имена уникальны", () => {
  assert.deepEqual(TOKEN_CATALOG.map((c) => c.id), ["colors", "radius", "spacing", "typography", "controls"]);
  const seen = new Set();
  for (const category of TOKEN_CATALOG) {
    assert.ok(category.items.length > 0, `${category.id} не пуста`);
    for (const item of category.items) {
      assert.match(item.name, /^--mapp-[a-z0-9-]+$/);
      for (const name of [item.name, ...(item.aliases || [])]) {
        assert.equal(seen.has(name), false, `дубликат ${name}`);
        seen.add(name);
      }
    }
  }
});

test("buildModel привязывает строку к существующему алиасу", () => {
  const vars = parseRootVars(SAMPLE);
  const colors = buildModel(vars).find((s) => s.id === "colors");
  const bg = colors.rows.find((r) => r.canonical === "--mapp-bg");
  assert.equal(bg.name, "--mapp-color-bg", "алиас темы выигрывает у каноничного имени");
  assert.equal(bg.value, "#f5f6f8");
  assert.equal(bg.present, true);
  const accent = colors.rows.find((r) => r.canonical === "--mapp-accent");
  assert.equal(accent.present, false, "отсутствующий токен показывает значение по умолчанию");
  assert.equal(accent.value, accent.default);
});

test("boundName не создаёт второй токен, если в теме только алиас", () => {
  const vars = parseRootVars(SAMPLE);
  const item = TOKEN_CATALOG[0].items.find((i) => i.name === "--mapp-bg");
  assert.equal(boundName(vars, item), "--mapp-color-bg");
  setVar(vars, boundName(vars, item), "#000000");
  assert.equal(vars.filter((v) => v.value === "#000000").length, 1);
  assert.equal(vars.some((v) => v.name === "--mapp-bg"), false);
});

test("переменные вне каталога попадают в раздел «Прочее» и не теряются", () => {
  const vars = parseRootVars(`:root {\n  --mapp-custom-thing: 42px;\n  --mapp-color-bg: #ffffff;\n}\n`);
  const sections = buildModel(vars);
  const misc = sections.find((s) => s.id === "misc");
  assert.ok(misc, "раздел «Прочее» создан");
  assert.deepEqual(misc.rows.map((r) => r.name), ["--mapp-custom-thing"]);
  assert.equal(misc.rows[0].kind, "length");
  const rebuilt = parseRootVars(buildRootCss(vars));
  assert.ok(rebuilt.some((v) => v.name === "--mapp-custom-thing"));
});

test("setVar и removeVar: добавление, обновление, удаление", () => {
  const vars = parseRootVars(SAMPLE);
  setVar(vars, "--mapp-accent", "#1a7f37");
  assert.equal(vars.find((v) => v.name === "--mapp-accent").value, "#1a7f37");
  setVar(vars, "--mapp-accent", "#ff0000");
  assert.equal(vars.filter((v) => v.name === "--mapp-accent").length, 1);
  removeVar(vars, "--mapp-accent");
  assert.equal(vars.some((v) => v.name === "--mapp-accent"), false);
});

test("setVar отклоняет небезопасные значения и имена", () => {
  const vars = [];
  assert.throws(() => setVar(vars, "--mapp-bad", "red; color: blue"));
  assert.throws(() => setVar(vars, "--mapp-bad", "url(x.png)"));
  assert.throws(() => setVar(vars, "mapp-bad", "1px"));
});

test("formatLengthPx и parseLengthPx работают со степпером", () => {
  assert.equal(formatLengthPx(15), "15px");
  assert.equal(formatLengthPx(12.345), "12.35px");
  assert.equal(parseLengthPx("16px"), 16);
  assert.equal(parseLengthPx("1.5px"), 1.5);
  assert.equal(parseLengthPx("auto"), null);
});

test("missingDefaults перечисляет отсутствующие в теме токены каталога", () => {
  const vars = parseRootVars(SAMPLE);
  const missing = missingDefaults(vars);
  assert.ok(missing.some((m) => m.name === "--mapp-accent"));
  assert.equal(missing.some((m) => m.name === "--mapp-color-bg"), false);
});
