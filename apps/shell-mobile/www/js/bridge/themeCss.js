// Перезагрузка CSS активной темы в оболочке.
//
// Нативный слой отдаёт тему по https://mapp.local/theme.css и сбрасывает
// кэш при смене активной темы (MappSystemPlugin.onActiveThemeChanged), после
// чего шлёт событие themeChanged. MappHostBridge превращает его в
// window CustomEvent "mapp:event", который мы здесь и слушаем.

const THEME_HREF = "https://mapp.local/theme.css";
const LINK_ID = "mapp-theme-css";

// Double buffering: новый <link> грузится рядом со старым и подменяет его
// только после onload, иначе на время загрузки оболочка осталась бы без
// токенов и мигнула запасными значениями. При ошибке новый <link>
// удаляется, старый остаётся — как и в SDK (miniapps/_sdk/MappHub.js).
export function reloadThemeCss() {
  const current = document.getElementById(LINK_ID);
  const next = document.createElement("link");
  next.rel = "stylesheet";
  next.href = `${THEME_HREF}?v=${Date.now()}`;

  next.addEventListener("load", () => {
    if (current && current.parentNode) current.remove();
    next.id = LINK_ID;
  }, { once: true });

  next.addEventListener("error", () => {
    next.remove();
  }, { once: true });

  document.head.appendChild(next);
  return next;
}

export function startThemeCss() {
  window.addEventListener("mapp:event", (event) => {
    const detail = event.detail || {};
    if (detail.event === "themeChanged") reloadThemeCss();
  });
}
