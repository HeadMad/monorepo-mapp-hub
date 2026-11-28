// Разбор CSS темы в набор переменных: "--mapp-color-bg: #f5f6f8" -> { "--mapp-color-bg": "#f5f6f8" }.
//
// Тема хранится в SQLite одним блоком :root { ... } (канонический вид —
// MappThemeCss.canonicalize, прочитать может любой: themes/<id> в system_kv).
// Оболочка отдаёт этот набор мини-приложениям по мосту (ui.getThemeTokens),
// поэтому разбор обязан совпадать с генератором theme.css: всё, что не похоже
// на объявление переменной, молча пропускается, а не роняет вызов.
export function parseCssVariables(css) {
  const tokens = {};
  if (typeof css !== "string") return tokens;
  const open = css.indexOf("{");
  const close = css.lastIndexOf("}");
  if (open < 0 || close <= open) return tokens;
  for (const declaration of css.slice(open + 1, close).split(";")) {
    const colon = declaration.indexOf(":");
    if (colon <= 0) continue;
    const name = declaration.slice(0, colon).trim();
    const value = declaration.slice(colon + 1).trim();
    if (!/^--[A-Za-z0-9_-]{1,64}$/.test(name)) continue;
    if (!value || /[{}<>]/.test(value)) continue;
    tokens[name] = value;
  }
  return tokens;
}
