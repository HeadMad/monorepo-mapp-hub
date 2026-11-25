const ROOT_BLOCK = /^\s*:root\s*\{([\s\S]*)\}\s*$/;
const VAR_NAME = /^--[A-Za-z0-9_-]{1,64}$/;
const FORBIDDEN_VALUE = /[{}<>@\\;]|\burl\s*\(|\bimage(-set)?\s*\(|\bsrc\s*\(|\bcross-fade\s*\(/i;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export function groupOf(name) {
  const short = name.replace(/^--mapp-/, "");
  if (short.startsWith("color-")) return "color";
  if (short.startsWith("radius-")) return "radius";
  return "text";
}

export function isHexColor(value) {
  return HEX_COLOR.test(value);
}

export function validateValue(name, value) {
  if (!VAR_NAME.test(name)) throw new Error(`invalid variable name: ${name}`);
  if (!value || FORBIDDEN_VALUE.test(value)) throw new Error(`invalid value for ${name}`);
  return value;
}

export function parseRootVars(css) {
  const match = ROOT_BLOCK.exec(String(css));
  if (!match) throw new Error("css must be a single :root { ... } block");
  return match[1]
    .split(";")
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .map((declaration) => {
      const colon = declaration.indexOf(":");
      if (colon <= 0) throw new Error(`invalid declaration: ${declaration}`);
      const name = declaration.slice(0, colon).trim();
      const value = declaration.slice(colon + 1).trim();
      return { name, value, group: groupOf(name) };
    });
}

export function buildRootCss(vars) {
  const lines = vars.map(({ name, value }) => `  ${name}: ${validateValue(name, String(value).trim())};`);
  return `:root {\n${lines.join("\n")}\n}\n`;
}
