import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRootVars, buildRootCss, groupOf, isHexColor } from "../../miniapps/theme-editor/tokens.js";

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
