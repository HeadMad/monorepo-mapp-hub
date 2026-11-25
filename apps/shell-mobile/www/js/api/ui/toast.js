const DEFAULT_MS = 2500;

export default async function (params = {}) {
  const text = String(params.message ?? "");
  if (!text) throw new Error("Нужен текст уведомления (message)");
  const ms = Math.min(Math.max(Number(params.duration) || DEFAULT_MS, 500), 10000);

  let el = document.getElementById("shell-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "shell-toast";
    Object.assign(el.style, {
      position: "fixed", left: "50%", bottom: "24px", transform: "translateX(-50%)",
      maxWidth: "90vw", padding: "10px 16px", borderRadius: "8px", zIndex: "10000",
      background: "var(--app-card-bg)", color: "var(--app-text)", border: "1px solid var(--app-border)",
      boxShadow: "0 6px 18px rgba(0,0,0,0.4)", fontSize: "0.95rem", textAlign: "center", pointerEvents: "none",
    });
    document.body.append(el);
  }
  el.textContent = text;
  el.hidden = false;
  clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(() => { el.hidden = true; }, ms);
  return { shown: true };
}
