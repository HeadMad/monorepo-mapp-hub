import { SHELL_VERSION } from "./version.js";
import { getInstalled, getSettings, saveInstalled } from "./core/store.js";
import { runBundleInstall, LAUNCHER_ID, installCatalogApp } from "./installer/bundle.js";
import {
  startMappHostBridge,
  mountMiniApp,
  unmountMiniApp,
  isBridgeMethod,
  invokeBridgeMethod,
  attachBus,
  deliverToApp,
  mountRelayed,
  unmountRelayed,
} from "./bridge/MappHostBridge.js";
import { ServiceHost } from "./bridge/services.js";
import { MessageBus, CONSOLE_ID, SHELL_ID } from "./bridge/bus.js";
import { formatArgs } from "./core/formatArgs.js";
import { installPreinstalled } from "./installer/preinstalled.js";
import { DialogClient } from "./dialogs/client.js";

// Разрешение, которое проверяется до вызова экшена. Отсутствие записи = разрешение не требуется.
const PERMISSION_MAP = {
  "device.info": "device.info",
  "device.clipboardRead": "device.clipboard",
  "geo.getCurrentPosition": "device.geolocation",
  "ui.openExternal": "ui.externalUrl",
  "miniapp.install": "miniapps.install",
  "shell.setTokens": "shell.tokens",
  "host.setLayout": "shell.host",
};

const BROWSER_ID = "com.mapphub.browser";
const CONSOLE_TOGGLE = "shell.console.toggle";
const CONSOLE_DOCK_HEIGHT = 260;
const LOG_MAX_CHARS = 8000;

function miniAppUrl(appId, path = "index.html") {
  return `https://miniapp-${appId}.local/${path}`;
}

function rpcError(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

class MappShellRuntime {
  constructor() {
    this.iframe = document.getElementById("app-frame");
    this.currentAppId = null;
    this.hostedAppId = null;
    this.consoleVisible = false;
    this.bus = new MessageBus((sub, message) => this.deliverBus(sub, message));
    attachBus(this.bus);
    this.bus.subscribe({ appId: SHELL_ID, iframe: null }, { type: CONSOLE_TOGGLE });
    this.services = new ServiceHost({
      host: document.getElementById("svc-host"),
      urlFor: miniAppUrl,
      main: () => ({ appId: this.currentAppId, iframe: this.iframe }),
      ensureInstalled: (appId) => installCatalogApp(appId, this.apiContext(null)),
    });
    this.consoleServices = new ServiceHost({
      host: document.getElementById("console-host"),
      urlFor: miniAppUrl,
      main: () => ({ appId: null, iframe: null }),
      ensureInstalled: (appId) => installCatalogApp(appId, this.apiContext(null)),
    });
    this.dialogService = new ServiceHost({
      host: document.getElementById("dialog-host"),
      urlFor: miniAppUrl,
      main: () => ({ appId: null, iframe: null }),
      ensureInstalled: (appId) => installCatalogApp(appId, this.apiContext(null)),
    });
    this.captureShellConsole();
    window.addEventListener("message", (event) => this.onMessage(event));
    startMappHostBridge();
    this.start();
  }

  captureShellConsole() {
    for (const level of ["log", "info", "warn", "error", "debug"]) {
      const original = console[level].bind(console);
      console[level] = (...args) => {
        original(...args);
        this.publishLog(level, formatArgs(args));
      };
    }
    window.addEventListener("error", (e) => this.publishLog("error", e.message));
    window.addEventListener("unhandledrejection", (e) => this.publishLog("error", formatArgs([e.reason])));
  }

  publishLog(level, text) {
    this.bus.publish("shell", {
      type: `console.${level}`,
      data: { text: String(text).slice(0, LOG_MAX_CHARS), ts: Date.now() },
    });
  }

  deliverBus(sub, message) {
    if (sub.target.local) {
      sub.target.local(message);
      return true;
    }
    if (sub.appId === SHELL_ID) {
      this.toggleConsole().catch((err) => console.error(err.message));
      return true;
    }
    return deliverToApp(sub.appId, "bus.message", { subId: sub.subId, message });
  }

  async toggleConsole() {
    if (this.consoleVisible) {
      this.consoleServices.setLayout("hidden");
      this.consoleVisible = false;
      return;
    }
    await this.consoleServices.targetFrame(CONSOLE_ID);
    this.consoleServices.setLayout("dock", CONSOLE_DOCK_HEIGHT);
    this.consoleVisible = true;
  }

  async start() {
    await installPreinstalled();
    this.dialogs = new DialogClient({ bus: this.bus, host: this.dialogService });
    let startId = this.startAppId();
    while (!startId) {
      await runBundleInstall(this.apiContext(null));
      startId = this.startAppId();
    }
    this.loadMiniApp(miniAppUrl(startId), startId);
    this.checkShellUpdateOnStart();
  }

  startAppId() {
    const { startAppId } = getSettings();
    if (startAppId && getInstalled(startAppId)) return startAppId;
    return getInstalled(LAUNCHER_ID) ? LAUNCHER_ID : null;
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
    unmountMiniApp(this.iframe);
    this.bus.dropFrame(this.iframe);
    this.currentAppId = appId;
    if (appId) {
      const rec = getInstalled(appId);
      mountMiniApp(this.iframe, appId, rec ? rec.permissions || [] : []);
    }
    this.iframe.src = url;
  }

  // Принимаем сообщения только от iframe оболочки.
  async onMessage(event) {
    const data = event.data || {};
    if (data.jsonrpc !== "2.0") return;
    if (!data.method) {
      this.services.settle(data, event.source);
      this.consoleServices.settle(data, event.source);
      this.dialogService.settle(data, event.source);
      return;
    }
    const { method, params, id } = data;
    const frame = this.services.frameOf(event.source) || this.consoleServices.frameOf(event.source) || this.dialogService.frameOf(event.source);
    if (!frame || isBridgeMethod(method)) return;
    try {
      const result = await this.handleRpc(method, params || {}, frame.appId, frame.iframe);
      this.reply(event.source, { jsonrpc: "2.0", result, id });
    } catch (err) {
      this.reply(event.source, {
        jsonrpc: "2.0",
        error: { code: err.code || -32000, message: err.message || "Internal error" },
        id,
      });
    }
  }

  async handleRpc(method, params, appId, iframe = null) {
    const required = PERMISSION_MAP[method] || null;
    if (required) await this.ensurePermission(required, appId);
    if (method === "miniapp.install") params = { ...params, silent: false };

    if (method === "shell.navigate") return this.navigate(params);
    if (method === "host.relay") return this.relay(params, appId);
    if (method === "shell.setTokens") {
      this.updateTokens(params.tokens || {});
      return { success: true };
    }

    const [category, action, ...rest] = method.split(".");
    if (!category || !action || rest.length) {
      throw rpcError(-32600, "Invalid method format. Use category.action");
    }
    const fn = await this.loadApi(category, action);
    return fn(params, this.apiContext(appId, iframe));
  }

  async navigate(params) {
    if (this.hostedAppId) unmountRelayed(this.hostedAppId);
    if (params.appId) {
      const rec = getInstalled(params.appId);
      if (!rec) throw rpcError(-32004, "Мини-приложение не установлено");
      if (rec.service) throw rpcError(-32004, "Служебное приложение нельзя открыть напрямую");
      this.hostedAppId = params.appId;
      await this.services.invoke({
        to: BROWSER_ID,
        from: null,
        method: "browser.open",
        params: { appId: params.appId, title: rec.name },
      });
      mountRelayed(this.services.frames.get(BROWSER_ID), BROWSER_ID, params.appId);
      return { success: true, appId: params.appId };
    }
    const url = String(params.url || "");
    if (!url || url.startsWith("/") || /^https?:/.test(url) || url.includes("..")) {
      throw rpcError(-32602, "Недопустимый путь: укажите путь относительно www");
    }
    this.hostedAppId = null;
    this.loadMiniApp(url, null);
    return { success: true, appId: null };
  }

  async relay(params, callerId) {
    const appId = this.hostedAppId;
    if (callerId !== BROWSER_ID || !appId || params.appId !== appId) {
      throw rpcError(-32001, "Relay denied");
    }
    const msg = params.message || {};
    if (typeof msg.method !== "string") throw rpcError(-32600, "Invalid relayed request");
    if (isBridgeMethod(msg.method)) {
      const rec = getInstalled(appId);
      return invokeBridgeMethod(msg.method, msg.params || {}, {
        appId,
        permissions: new Set(rec ? rec.permissions || [] : []),
      });
    }
    return this.handleRpc(msg.method, msg.params || {}, appId);
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

  apiContext(appId, iframe = null) {
    return {
      appId,
      caller: iframe ? { appId, iframe } : null,
      openModal: (opts) => this.dialogs.open(opts),
      showModal: (opts) => this.dialogs.open(opts).promise,
      toast: (opts) => this.dialogs.toast(opts),
      installUi: {
        start: (title) => this.dialogs.installStart(title),
        log: (text) => this.dialogs.installLog(text),
        progress: (name, percent) => this.dialogs.installProgress(name, percent),
        finish: (text) => this.dialogs.installFinish(text),
      },
      install: (params) => this.runInstall(params),
      services: this.services,
    };
  }

  async runInstall(params) {
    const install = await this.loadApi("miniapp", "install");
    return install(params, this.apiContext(null));
  }

  // Проверка разрешения по записи установленного мини-приложения.
  async ensurePermission(required, appId) {
    if (!appId) {
      throw rpcError(-32001, `Permission denied: ${required} (вызов не из установленного приложения)`);
    }
    const rec = getInstalled(appId);
    if (!rec) throw rpcError(-32001, "Мини-приложение не установлено");
    const granted = rec.permissions || [];
    if (granted.includes(required)) return;

    const first = await this.dialogs.open({
      title: "Нет разрешения",
      message: `У мини-приложения «${rec.name}» нет разрешения «${required}».\n\nВы можете выдать его сейчас.`,
      buttons: [{ id: "cancel", text: "Отмена" }, { id: "fix", text: "Исправить", primary: true }],
    }).promise;
    if (first.action !== "fix") throw rpcError(-32001, `Permission denied: ${required}`);

    const requested = rec.requestedPermissions || granted;
    if (!requested.includes(required)) {
      throw rpcError(-32001, `Permission ${required} не объявлено в mappmanifest.json`);
    }
    const second = await this.dialogs.open({
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
