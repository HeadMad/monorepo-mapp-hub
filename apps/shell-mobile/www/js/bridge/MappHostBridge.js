const PLUGIN_NAME = "MappSystem";
const THEME_NAMESPACE = "theme";
const THEME_TOKENS_KEY = "tokens";

const frames = new WeakMap();
const mounted = new Map();

function plugin() {
  return window.Capacitor.Plugins[PLUGIN_NAME];
}

function originFor(appId) {
  return `https://miniapp-${appId}.local`;
}

const handlers = {
  "storage.getItem": (params, appId) =>
    plugin().storageGetItem({ appId, key: params.key }),
  "storage.setItem": (params, appId) =>
    plugin().storageSetItem({ appId, key: params.key, value: params.value }),
  "storage.removeItem": (params, appId) =>
    plugin().storageRemoveItem({ appId, key: params.key }),
  "storage.getKeys": (_params, appId) =>
    plugin().storageGetKeys({ appId }),
  "storage.clear": (_params, appId) =>
    plugin().storageClear({ appId }),
  "ui.getThemeTokens": async () => {
    const res = await plugin().systemGet({ namespace: THEME_NAMESPACE, key: THEME_TOKENS_KEY });
    return { tokens: res.value ? JSON.parse(res.value) : {} };
  },
};

async function onMessage(event) {
  const appId = frames.get(event.source);
  const data = event.data;
  if (!appId || event.origin !== originFor(appId)) return;
  if (!data || data.jsonrpc !== "2.0" || typeof data.method !== "string" || data.id === undefined) return;

  const reply = (body) => event.source.postMessage({ jsonrpc: "2.0", id: data.id, ...body }, event.origin);
  const handler = handlers[data.method];
  if (!handler) {
    reply({ error: { message: `Method not found: ${data.method}` } });
    return;
  }
  try {
    reply({ result: await handler(data.params || {}, appId) });
  } catch (err) {
    reply({ error: { message: err && err.message ? err.message : String(err) } });
  }
}

export function mountMiniApp(iframe, appId) {
  frames.set(iframe.contentWindow, appId);
  mounted.set(appId, iframe);
}

export function unmountMiniApp(appId) {
  mounted.delete(appId);
}

export function broadcastThemeChanged(tokens) {
  for (const [appId, iframe] of mounted) {
    if (!iframe.contentWindow) continue;
    iframe.contentWindow.postMessage(
      { jsonrpc: "2.0", method: "event.themeChanged", params: { tokens } },
      originFor(appId)
    );
  }
}

export function startMappHostBridge() {
  window.addEventListener("message", onMessage);
}
