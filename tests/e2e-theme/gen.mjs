// Рендерит theme.css тем же генератором, что и оболочка (apps/shell-mobile/www/assets/theme.css.js).
// argv[2] — JSON {active, themes: {id: css}}. RHINO_WRAP=1 отдаёт значения базы как String-обёртки,
// как Java-строки в Rhino (typeof "object"), чтобы поймать регрессию с typeof.
const gen = (await import(new URL("../../apps/shell-mobile/www/assets/theme.css.js", import.meta.url))).default;
const wrap = (v) => (process.env.RHINO_WRAP === "1" && v !== null ? new String(v) : v);
const state = JSON.parse(process.argv[2]);
const db = {
  getSystemKv(namespace, key) {
    if (namespace === "config" && key === "active_theme") return wrap(state.active);
    if (namespace === "themes") return wrap(state.themes[key] ?? null);
    return null;
  },
};
process.stdout.write(gen({ db, query: {} }).body);
