// Разбор и сборка CSS-переменных темы, каталог токенов и модель для UI.
// Тема хранится как единственный блок :root { ... }, остальное отклоняется.

const ROOT_BLOCK = /^\s*:root\s*\{([\s\S]*)\}\s*$/;
export const VAR_NAME = /^--[A-Za-z0-9_-]{1,64}$/;
const FORBIDDEN_VALUE = /[{}<>@\\;]|\burl\s*\(|\bimage(-set)?\s*\(|\bsrc\s*\(|\bcross-fade\s*\(/i;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const LENGTH_PX = /^-?\d+(\.\d+)?px$/;

// Каталог описывает, как раскладывать токены по категориям и каким контролом их
// редактировать. `name` — каноничное имя, `aliases` — имена, которые оболочка и
// старые темы уже используют. Если в теме есть только алиас, строка редактирует
// именно его, чтобы не появился второй, «мёртвый» токен.
export const TOKEN_CATALOG = [
  {
    id: "colors",
    title: "Цвета",
    icon: "colors",
    items: [
      { name: "--mapp-bg", label: "Фон", kind: "color", default: "#f5f6f8", aliases: ["--mapp-color-bg"] },
      { name: "--mapp-bg-elevated", label: "Приподнятый фон", kind: "color", default: "#ffffff" },
      { name: "--mapp-bg-muted", label: "Приглушённый фон", kind: "color", default: "#eaeef2" },
      { name: "--mapp-surface", label: "Поверхность", kind: "color", default: "#ffffff", aliases: ["--mapp-color-surface"] },
      { name: "--mapp-surface-2", label: "Поверхность 2", kind: "color", default: "#ffffff" },
      { name: "--mapp-border", label: "Границы", kind: "color", default: "#d0d7de", aliases: ["--mapp-color-border"] },
      { name: "--mapp-text", label: "Текст", kind: "color", default: "#1f2328", aliases: ["--mapp-color-text"] },
      { name: "--mapp-muted", label: "Вторичный текст", kind: "color", default: "#656d76", aliases: ["--mapp-color-muted"] },
      { name: "--mapp-primary", label: "Основной", kind: "color", default: "#2563eb", aliases: ["--mapp-color-primary"] },
      { name: "--mapp-color-primary-text", label: "Текст на основном", kind: "color", default: "#ffffff" },
      { name: "--mapp-accent", label: "Акцент", kind: "color", default: "#1a7f37" },
      { name: "--mapp-danger", label: "Опасное действие", kind: "color", default: "#dc2626", aliases: ["--mapp-color-danger"] },
    ],
  },
  {
    id: "radius",
    title: "Скругления",
    icon: "radius",
    items: [
      { name: "--mapp-radius-sm", label: "Малое", kind: "length", default: "6px", min: 0, step: 1 },
      { name: "--mapp-radius-md", label: "Базовое", kind: "length", default: "12px", min: 0, step: 1, aliases: ["--mapp-radius"] },
      { name: "--mapp-radius-lg", label: "Большое", kind: "length", default: "20px", min: 0, step: 1 },
      { name: "--mapp-radius-xl", label: "Очень большое", kind: "length", default: "28px", min: 0, step: 1 },
    ],
  },
  {
    id: "spacing",
    title: "Отступы и размеры",
    icon: "spacing",
    items: [
      { name: "--mapp-space-1", label: "Отступ 1", kind: "length", default: "4px", min: 0, step: 1 },
      { name: "--mapp-space-2", label: "Отступ 2", kind: "length", default: "8px", min: 0, step: 1 },
      { name: "--mapp-space-3", label: "Отступ 3", kind: "length", default: "12px", min: 0, step: 1 },
      { name: "--mapp-space-4", label: "Отступ 4", kind: "length", default: "16px", min: 0, step: 1 },
      { name: "--mapp-space-5", label: "Отступ 5", kind: "length", default: "24px", min: 0, step: 1 },
      { name: "--mapp-header-h", label: "Высота шапки", kind: "length", default: "56px", min: 0, step: 1 },
    ],
  },
  {
    id: "typography",
    title: "Типографика",
    icon: "typography",
    items: [
      { name: "--mapp-font-family", label: "Шрифт", kind: "text", default: "'Roboto', system-ui, sans-serif" },
      { name: "--mapp-font-size-base", label: "Базовый размер", kind: "length", default: "16px", min: 8, step: 1, aliases: ["--mapp-font-size"] },
      { name: "--mapp-font-size-sm", label: "Мелкий размер", kind: "length", default: "14px", min: 8, step: 1 },
      { name: "--mapp-font-size-lg", label: "Крупный размер", kind: "length", default: "18px", min: 8, step: 1 },
    ],
  },
  {
    id: "controls",
    title: "Контролы и компоненты",
    icon: "controls",
    items: [
      { name: "--mapp-control-h", label: "Высота контрола", kind: "length", default: "44px", min: 0, step: 1 },
      { name: "--mapp-control-h-sm", label: "Высота контрола (S)", kind: "length", default: "32px", min: 0, step: 1 },
      { name: "--mapp-control-h-lg", label: "Высота контрола (L)", kind: "length", default: "56px", min: 0, step: 1 },
      { name: "--mapp-icon-size", label: "Размер иконки", kind: "length", default: "22px", min: 0, step: 1 },
    ],
  },
];

const CATALOG_INDEX = new Map();
for (const category of TOKEN_CATALOG) {
  for (const item of category.items) {
    CATALOG_INDEX.set(item.name, { item, category });
    for (const alias of item.aliases || []) CATALOG_INDEX.set(alias, { item, category });
  }
}

export function hexOf(value) {
  return isHexColor(value) ? value.toLowerCase() : null;
}

export function isHexColor(value) {
  return HEX_COLOR.test(value);
}

export function isLengthPx(value) {
  return LENGTH_PX.test(value);
}

export function parseLengthPx(value) {
  return LENGTH_PX.test(value) ? parseFloat(value) : null;
}

export function formatLengthPx(number) {
  const rounded = Math.round(number * 100) / 100;
  return `${rounded}px`;
}

export function inferKind(value) {
  if (isHexColor(value)) return "color";
  if (isLengthPx(value)) return "length";
  return "text";
}

export function groupOf(name) {
  const short = String(name).replace(/^--mapp-/, "");
  const known = CATALOG_INDEX.get(name);
  if (known) return known.item.kind === "color" ? "color" : known.item.kind === "length" && known.category.id === "radius" ? "radius" : "text";
  if (short.startsWith("color-") || short === "bg" || short === "text" || short === "border" || short === "primary" || short === "danger") return "color";
  if (short.startsWith("radius")) return "radius";
  return "text";
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

export function findVar(vars, name) {
  return vars.find((v) => v.name === name) || null;
}

// Возвращает имя переменной, к которому привязана строка каталога: саму себя,
// если она есть в теме, иначе первый существующий алиас, иначе каноничное имя.
export function boundName(vars, item) {
  if (findVar(vars, item.name)) return item.name;
  for (const alias of item.aliases || []) {
    if (findVar(vars, alias)) return alias;
  }
  return item.name;
}

export function setVar(vars, name, value) {
  const trimmed = String(value).trim();
  validateValue(name, trimmed);
  const existing = findVar(vars, name);
  if (existing) {
    existing.value = trimmed;
    existing.group = groupOf(name);
  } else {
    vars.push({ name, value: trimmed, group: groupOf(name) });
  }
  return vars;
}

export function removeVar(vars, name) {
  const index = vars.findIndex((v) => v.name === name);
  if (index >= 0) vars.splice(index, 1);
  return vars;
}

// Модель для рендера: категории каталога в фиксированном порядке плюс «Прочее»
// для переменных вне каталога — они не теряются и остаются редактируемыми.
export function buildModel(vars) {
  const used = new Set();
  const sections = TOKEN_CATALOG.map((category) => ({
    id: category.id,
    title: category.title,
    icon: category.icon,
    rows: category.items.map((item) => {
      const name = boundName(vars, item);
      const current = findVar(vars, name);
      if (current) used.add(current.name);
      return {
        canonical: item.name,
        name,
        label: item.label,
        kind: item.kind,
        default: item.default,
        min: item.min,
        max: item.max,
        step: item.step,
        value: current ? current.value : item.default,
        present: Boolean(current),
        category: category.title,
      };
    }),
  }));

  const extra = vars.filter((v) => !used.has(v.name) && !CATALOG_INDEX.has(v.name));
  const shadowed = vars.filter((v) => !used.has(v.name) && CATALOG_INDEX.has(v.name));
  const leftovers = [...extra, ...shadowed];
  if (leftovers.length) {
    sections.push({
      id: "misc",
      title: "Прочее",
      icon: "misc",
      rows: leftovers.map((v) => ({
        canonical: v.name,
        name: v.name,
        label: "Вне каталога",
        kind: inferKind(v.value),
        default: null,
        value: v.value,
        present: true,
        category: "Прочее",
      })),
    });
  }
  return sections;
}

export function missingDefaults(vars) {
  const missing = [];
  for (const section of buildModel(vars)) {
    for (const row of section.rows) {
      if (!row.present) missing.push({ name: row.name, value: row.default, label: row.label });
    }
  }
  return missing;
}
