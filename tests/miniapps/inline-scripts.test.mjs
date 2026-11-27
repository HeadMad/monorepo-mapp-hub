import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";

const root = join(import.meta.dirname, "../../miniapps");

// Модульные скрипты в miniapp-ах запускаются в браузере как есть, но проверить их
// синтаксис через vm.Script нельзя: import/export — это модульный синтаксис.
// Поэтому импорты вырезаются, а экспорты переводятся в обычные объявления.
function asClassicScript(code) {
  return code
    .replace(/^\s*import\s+[\s\S]*?\s+from\s+["'][^"']+["'];?\s*$/gm, "")
    .replace(/^\s*import\s+["'][^"']+["'];?\s*$/gm, "")
    .replace(/^export\s+(default\s+)?/gm, "");
}

for (const dir of readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory())) {
  const file = join(root, dir.name, "index.html");
  if (!existsSync(file)) continue;
  test(`inline scripts parse: ${dir.name}`, () => {
    const html = readFileSync(file, "utf8");
    for (const [, code] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
      assert.doesNotThrow(() => new vm.Script(code, { filename: file }));
    }
  });

  test(`module scripts parse: ${dir.name}`, () => {
    const html = readFileSync(file, "utf8");
    const modules = [...html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)];
    for (const [, code] of modules) {
      assert.doesNotThrow(() => new vm.Script(asClassicScript(code), { filename: file }));
    }
  });
}
