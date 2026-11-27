import { DIALOGS_ID, SHELL_ID } from "../bridge/bus.js";

const DEFAULT_TOAST_MS = 2500;
const MIN_TOAST_MS = 500;
const MAX_TOAST_MS = 10000;
const TOAST_MARGIN_MS = 150;

function newId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, "0")).join("");
}

export class DialogClient {
  constructor({ bus, host }) {
    this.bus = bus;
    this.host = host;
    this.pending = new Map();
    this.toastTimer = null;
    this.installActive = false;
    this.installExpanded = false;
    this.ready = new Promise((resolve, reject) => {
      this.markReady = resolve;
      this.markFailed = reject;
    });
    this.ready.catch(() => {});
    const target = { appId: SHELL_ID, iframe: null, local: (msg) => this.onMessage(msg) };
    this.bus.subscribe(target, { type: "dialog.*", app: DIALOGS_ID });
    this.bus.subscribe(target, { type: "install.*", app: DIALOGS_ID });
    host.targetFrame(DIALOGS_ID).catch((err) => this.markFailed(err));
  }

  // Установка: оболочка только публикует события, UI (строка прогресса и лог) живёт в com.mapphub.dialogs.
  installStart(title) {
    this.installActive = true;
    this.installExpanded = false;
    this.send("install.start", { title: String(title ?? "Установка") });
    this.ready.then(() => this.syncVisibility()).catch(() => {});
  }

  installLog(text) {
    this.send("install.log", { text: String(text ?? "") });
  }

  installProgress(name, percent) {
    const value = Math.min(100, Math.max(0, Math.round(Number(percent) || 0)));
    this.send("install.progress", { name: String(name ?? ""), percent: value });
  }

  installFinish(text) {
    this.send("install.finish", { text: String(text ?? "") });
  }

  open(opts = {}) {
    const id = newId();
    const { onChange, ...payload } = opts;
    const entry = { onChange, handle: null, resolve: null };
    entry.promise = new Promise((resolve) => (entry.resolve = resolve));
    entry.handle = {
      promise: entry.promise,
      update: (patch = {}) => {
        const { onChange: next, ...rest } = patch;
        if (next) entry.onChange = next;
        this.send("dialog.update", { id, patch: rest }, id);
      },
      close: () => this.send("dialog.close", { id }, id),
    };
    this.pending.set(id, entry);
    this.host.setLayout("overlay");
    this.send("dialog.open", { id, opts: { ...payload, hasOnChange: !!onChange } }, id);
    return entry.handle;
  }

  async toast(params = {}) {
    const message = String(params.message ?? "");
    const duration = Math.min(Math.max(Number(params.duration) || DEFAULT_TOAST_MS, MIN_TOAST_MS), MAX_TOAST_MS);
    await this.ready;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastTimer = null;
      this.syncVisibility();
    }, duration + TOAST_MARGIN_MS);
    this.syncVisibility();
    this.bus.publish(SHELL_ID, { type: "dialog.toast", data: { message, duration }, to: DIALOGS_ID });
    return { shown: true };
  }

  send(type, data, id) {
    this.ready
      .then(() => this.bus.publish(SHELL_ID, { type, data, to: DIALOGS_ID }))
      .catch((err) => {
        if (id) this.settle(id, { action: "closed", checked: {}, radios: {}, error: err.message });
      });
  }

  onMessage(msg) {
    if (msg.app !== DIALOGS_ID) return;
    const data = msg.data || {};
    if (msg.type === "dialog.ready") this.markReady();
    else if (msg.type === "dialog.change") {
      const entry = this.pending.get(data.id);
      if (entry && entry.onChange) entry.onChange(data.result, entry.handle);
    } else if (msg.type === "dialog.result") this.settle(data.id, data.result);
    else if (msg.type === "install.expanded") {
      this.installExpanded = !!data.value;
      this.syncVisibility();
    } else if (msg.type === "install.dismissed") {
      this.installActive = false;
      this.installExpanded = false;
      this.syncVisibility();
    }
  }

  settle(id, result) {
    const entry = this.pending.get(id);
    if (!entry) return;
    this.pending.delete(id);
    entry.resolve(result);
    this.syncVisibility();
  }

  // Приоритет слоя: модальное окно или развёрнутый лог > тост > строка установки > скрыто.
  syncVisibility() {
    if (this.pending.size || this.installExpanded) this.host.setLayout("overlay");
    else if (this.toastTimer) this.host.setLayout("toast");
    else this.host.setLayout(this.installActive ? "bar" : "hidden");
  }
}
