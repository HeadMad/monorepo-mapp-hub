import { getInstalled } from "../core/store.js";
import { mountMiniApp, unmountMiniApp, originFor } from "./MappHostBridge.js";

const INVOKE_TIMEOUT_MS = 30000;
const LOAD_TIMEOUT_MS = 20000;
const LAYOUT_MODES = new Set(["hidden", "overlay", "dock"]);
const MAX_DOCK_HEIGHT = 300;

export class ServiceHost {
  constructor({ host, urlFor, main, ensureInstalled }) {
    this.host = host;
    this.urlFor = urlFor;
    this.main = main;
    this.ensureInstalled = ensureInstalled;
    this.frames = new Map();
    this.ready = new Map();
    this.pending = new Map();
    this.seq = 0;
  }

  frameOf(win) {
    const main = this.main();
    if (main.iframe && main.iframe.contentWindow === win) return { appId: main.appId, iframe: main.iframe };
    for (const [appId, iframe] of this.frames) {
      if (iframe.contentWindow === win) return { appId, iframe };
    }
    return null;
  }

  async invoke({ to, from, method, params }) {
    const iframe = await this.targetFrame(to);
    const id = `inv_${++this.seq}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method}: нет ответа от ${to}`));
      }, INVOKE_TIMEOUT_MS);
      this.pending.set(id, {
        win: iframe.contentWindow,
        resolve: (msg) => {
          clearTimeout(timer);
          if (msg.error) reject(new Error(msg.error.message));
          else resolve(msg.result ?? null);
        },
      });
      iframe.contentWindow.postMessage(
        { __mapp_invoke__: true, id, from, method, params },
        originFor(to),
      );
    });
  }

  settle(msg, source) {
    const entry = this.pending.get(msg.id);
    if (!entry || entry.win !== source) return;
    this.pending.delete(msg.id);
    entry.resolve(msg);
  }

  setLayout(mode, height = 0) {
    if (!LAYOUT_MODES.has(mode)) throw new Error(`Неизвестный режим: ${mode}`);
    this.host.className = `svc-${mode}`;
    this.host.style.height = mode === "dock" ? `${Math.min(MAX_DOCK_HEIGHT, Math.max(0, Math.round(height)))}px` : "";
  }

  async targetFrame(appId) {
    const main = this.main();
    if (!appId) throw new Error("Не указано мини-приложение");
    if (appId === main.appId) return main.iframe;
    if (!this.ready.has(appId)) {
      const p = this.launch(appId);
      this.ready.set(appId, p);
      p.catch(() => this.ready.delete(appId));
    }
    return this.ready.get(appId);
  }

  async launch(appId) {
    if (!getInstalled(appId)) await this.ensureInstalled(appId);
    const rec = getInstalled(appId);

    const iframe = document.createElement("iframe");
    iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms");
    iframe.dataset.appId = appId;
    const loaded = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${appId}: не загрузилось`)), LOAD_TIMEOUT_MS);
      iframe.addEventListener("load", () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
    });
    iframe.src = this.urlFor(appId);
    this.host.append(iframe);
    mountMiniApp(iframe, appId, rec.permissions || []);
    this.frames.set(appId, iframe);

    try {
      await loaded;
    } catch (err) {
      this.frames.delete(appId);
      unmountMiniApp(iframe);
      iframe.remove();
      throw err;
    }
    return iframe;
  }
}
