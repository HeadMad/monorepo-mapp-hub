import { SHELL_VERSION } from "./version.js";
import { getInstalled, saveInstalled } from "./core/store.js";

// Разрешение, которое проверяется до вызова экшена. Отсутствие записи = разрешение не требуется.
const PERMISSION_MAP = {
  "device.info": "device.info",
  "device.clipboardRead": "device.clipboard",
  "geo.getCurrentPosition": "device.geolocation",
  "ui.openExternal": "ui.externalUrl",
  "miniapp.install": "miniapps.install",
  "shell.setTokens": "shell.tokens",
};

// Мини-приложения, которые поставляются внутри APK. Первый запуск ставит их через miniapp.install.
const BUNDLED_APPS = [
  { appId: "com.mapphub.launcher", entry: "miniapps/launcher/index.html", manifestUrl: "miniapps/launcher/mappmanifest.json", required: true },
  { appId: "com.mapphub.samplegame", entry: "miniapps/sample-game/index.html", manifestUrl: "miniapps/sample-game/mappmanifest.json", required: false },
];
const BUNDLED_BY_ENTRY = Object.fromEntries(BUNDLED_APPS.map((a) => [a.entry, a]));

function rpcError(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

// Единое модальное окно оболочки с очередью. Все окна (алерты, разрешения, установка, обновления)
// проходят через него и открываются по одному.
class ModalEngine {
  constructor() {
    this.el = document.getElementById("system-modal");
    this.titleEl = document.getElementById("modal-title");
    this.messageEl = document.getElementById("modal-message");
    this.checksEl = document.getElementById("modal-checks");
    this.progressEl = document.getElementById("modal-progress");
    this.progressBarEl = document.getElementById("modal-progress-bar");
    this.actionsEl = document.getElementById("modal-actions");
    this.queue = [];
    this.current = null;
  }

  // Возвращает handle: { promise, update(patch), close() }. promise резолвится {action, checked}.
  openModal(opts = {}) {
    const state = { opts: this.normalize(opts), resolve: null, promise: null, handle: null };
    state.promise = new Promise((resolve) => (state.resolve = resolve));
    state.handle = {
      promise: state.promise,
      update: (patch) => this.update(state, patch),
      close: () => this.finish(state, { action: "closed", checked: this.collect(state) }),
    };
    this.queue.push(state);
    if (!this.current) this.showNext();
    return state.handle;
  }

  normalize(opts) {
    return { ...opts, checkboxes: (opts.checkboxes || []).map((c) => ({ ...c })) };
  }

  update(state, patch) {
    const next = { ...patch };
    if (next.checkboxes) next.checkboxes = next.checkboxes.map((c) => ({ ...c }));
    Object.assign(state.opts, next);
    if (this.current === state) this.render(state);
  }

  showNext() {
    this.current = this.queue.shift() || null;
    if (!this.current) {
      this.el.style.display = "none";
      return;
    }
    this.render(this.current);
  }

  collect(state) {
    return Object.fromEntries((state.opts.checkboxes || []).map((c) => [c.id, !!c.checked]));
  }

  finish(state, result) {
    if (this.current === state) {
      this.current = null;
      this.showNext();
    } else {
      this.queue = this.queue.filter((s) => s !== state);
    }
    state.resolve(result);
  }

  render(state) {
    const o = state.opts;
    this.titleEl.textContent = o.title || "";
    this.messageEl.textContent = o.message || "";

    this.checksEl.innerHTML = "";
    for (const c of o.checkboxes) {
      const label = document.createElement("label");
      label.className = "modal-check";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = !!c.checked;
      input.disabled = !!c.disabled;
      input.onchange = () => {
        c.checked = input.checked;
        if (o.onChange) o.onChange(this.collect(state), state.handle);
      };
      const text = document.createElement("span");
      text.textContent = c.label;
      label.append(input, text);
      this.checksEl.append(label);
    }

    if (typeof o.progress === "number") {
      this.progressEl.hidden = false;
      this.progressBarEl.style.width = Math.min(100, Math.max(0, o.progress)) + "%";
    } else {
      this.progressEl.hidden = true;
    }

    const buttons = o.buttons && o.buttons.length ? o.buttons : [{ id: "ok", text: "OK", primary: true }];
    this.actionsEl.innerHTML = "";
    for (const b of buttons) {
      const btn = document.createElement("button");
      btn.textContent = b.text;
      btn.className = b.primary ? "btn-primary" : "btn-secondary";
      btn.disabled = !!b.disabled;
      btn.onclick = () => this.finish(state, { action: b.id || "ok", checked: this.collect(state) });
      this.actionsEl.append(btn);
    }
    this.el.style.display = "flex";
  }
}

class MappShellRuntime {
  constructor() {
    this.iframe = document.getElementById("app-frame");
    this.modal = new ModalEngine();
    this.currentAppId = null;
    window.addEventListener("message", (event) => this.onMessage(event));
    startMappHostBridge();
    this.start();
  }

  async start() {
    try {
      await this.bootstrap();
    } catch (e) {
      console.error("Bootstrap:", e);
    }
    const launcher = BUNDLED_APPS[0];
    this.loadMiniApp(launcher.entry, launcher.appId);
    this.checkShellUpdateOnStart();
  }

  // Первый запуск: ставим встроенные мини-приложения через тот же экшен miniapp.install.
  // Без лаунчера дальше не пускаем: окно повторяется, пока он не установлен.
  async bootstrap() {
    for (const app of BUNDLED_APPS) {
      while (!getInstalled(app.appId)) {
        const res = await this.runInstall({ manifestUrl: app.manifestUrl })
          .catch((e) => ({ installed: false, error: e.message }));
        if (res.installed) break;
        if (!app.required) break;
        await this.modal.openModal({
          title: "Лаунчер не установлен",
          message: res.error ? `Ошибка: ${res.error}` : "Без лаунчера оболочка не может работать.",
          buttons: [{ id: "retry", text: "Повторить", primary: true }],
        }).promise;
      }
    }
  }

  async checkShellUpdateOnStart() {
    try {
      const cfg = await this.loadConfig();
      if (!cfg.autoCheckUpdate) return;
      const checkUpdate = await this.loadApi("shell", "checkUpdate");
      await checkUpdate({ silent: true }, this.apiContext(null));
    } catch (e) {
      console.warn("Проверка обновления пропущена:", e.message);
    }
  }

  async loadConfig() {
    const res = await fetch("shell-config.json", { cache: "no-store" });
    if (!res.ok) throw new Error("shell-config.json недоступен");
    return res.json();
  }

  loadMiniApp(url, appId = null) {
    this.currentAppId = appId;
    this.iframe.src = url;
  }

  // Принимаем сообщения только от iframe оболочки.
  async onMessage(event) {
    if (event.source !== this.iframe.contentWindow) return;
    const { jsonrpc, method, params, id } = event.data || {};
    if (jsonrpc !== "2.0" || !method) return;
    try {
      const result = await this.handleRpc(method, params || {});
      this.reply(event.source, { jsonrpc: "2.0", result, id });
    } catch (err) {
      this.reply(event.source, {
        jsonrpc: "2.0",
        error: { code: err.code || -32000, message: err.message || "Internal error" },
        id,
      });
    }
  }

  async handleRpc(method, params) {
    const required = PERMISSION_MAP[method] || null;
    if (required) await this.ensurePermission(required);

    if (method === "shell.navigate") return this.navigate(params);
    if (method === "shell.setTokens") {
      this.updateTokens(params.tokens || {});
      return { success: true };
    }

    const [category, action, ...rest] = method.split(".");
    if (!category || !action || rest.length) {
      throw rpcError(-32600, "Invalid method format. Use category.action");
    }
    const fn = await this.loadApi(category, action);
    return fn(params, this.apiContext(this.currentAppId));
  }

  navigate(params) {
    const url = String(params.url || "");
    if (!url || url.startsWith("/") || /^https?:/.test(url) || url.includes("..")) {
      throw rpcError(-32602, "Недопустимый путь: укажите путь относительно www");
    }
    const bundled = BUNDLED_BY_ENTRY[url];
    this.loadMiniApp(url, bundled ? bundled.appId : null);
    return { success: true, appId: bundled ? bundled.appId : null };
  }

  // Загрузка файла экшена: api/<category>/<action>.js. Имена проверяются регулярками, чтобы не выйти из папки api.
  async loadApi(category, action) {
    const valid = /^[a-z][a-zA-Z0-9]*$/;
    if (!valid.test(category) || !valid.test(action)) {
      throw rpcError(-32600, "Invalid method format. Use category.action");
    }
    let mod;
    try {
      mod = await import(`./api/${category}/${action}.js`);
    } catch (e) {
      throw rpcError(-32601, `Method ${category}.${action} not found`);
    }
    if (typeof mod.default !== "function") {
      throw rpcError(-32601, `Method ${category}.${action} does not export a default function`);
    }
    return mod.default;
  }

  apiContext(appId) {
    return {
      appId,
      openModal: (opts) => this.modal.openModal(opts),
      showModal: (opts) => this.modal.openModal(opts).promise,
      install: (params) => this.runInstall(params),
    };
  }

  async runInstall(params) {
    const install = await this.loadApi("miniapp", "install");
    return install(params, this.apiContext(null));
  }

  // Проверка разрешения по записи установленного мини-приложения.
  async ensurePermission(required) {
    if (!this.currentAppId) {
      throw rpcError(-32001, `Permission denied: ${required} (вызов не из установленного приложения)`);
    }
    const rec = getInstalled(this.currentAppId);
    if (!rec) throw rpcError(-32001, "Мини-приложение не установлено");
    const granted = rec.permissions || [];
    if (granted.includes(required)) return;

    const first = await this.modal.openModal({
      title: "Нет разрешения",
      message: `У мини-приложения «${rec.name}» нет разрешения «${required}».\n\nВы можете выдать его сейчас.`,
      buttons: [{ id: "cancel", text: "Отмена" }, { id: "fix", text: "Исправить", primary: true }],
    }).promise;
    if (first.action !== "fix") throw rpcError(-32001, `Permission denied: ${required}`);

    const requested = rec.requestedPermissions || granted;
    if (!requested.includes(required)) {
      throw rpcError(-32001, `Permission ${required} не объявлено в mappmanifest.json`);
    }
    const second = await this.modal.openModal({
      title: `Разрешения: ${rec.name}`,
      message: "Отметьте разрешения, которые выдаете мини-приложению:",
      checkboxes: requested.map((p) => ({ id: p, label: p, checked: granted.includes(p) })),
      buttons: [{ id: "cancel", text: "Отмена" }, { id: "save", text: "Сохранить", primary: true }],
    }).promise;
    if (second.action !== "save") throw rpcError(-32001, `Permission denied: ${required}`);

    rec.permissions = requested.filter((p) => second.checked[p]);
    saveInstalled(rec);
    if (!rec.permissions.includes(required)) throw rpcError(-32001, `Permission denied: ${required}`);
  }

  reply(target, response) {
    if (target && typeof target.postMessage === "function") target.postMessage(response, "*");
  }

  updateTokens(tokens) {
    const root = document.documentElement;
    Object.entries(tokens).forEach(([key, value]) => root.style.setProperty(`--app-${key}`, value));
    if (this.iframe.contentWindow) {
      this.iframe.contentWindow.postMessage({ type: "TOKENS_UPDATED", tokens }, "*");
    }
  }
}

window.shellRuntime = new MappShellRuntime();
