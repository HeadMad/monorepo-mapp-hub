import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";

const root = join(import.meta.dirname, "../../miniapps");

for (const dir of readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory())) {
  const file = join(root, dir.name, "index.html");
  if (!existsSync(file)) continue;
  test(`inline scripts parse: ${dir.name}`, () => {
    const html = readFileSync(file, "utf8");
    for (const [, code] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
      assert.doesNotThrow(() => new vm.Script(code, { filename: file }));
    }
  });
}
