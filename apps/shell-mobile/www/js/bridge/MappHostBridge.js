import { parseCssVariables } from "../core/cssTokens.js";

const PLUGIN_NAME = "MappSystem";
const THEME_READ = "system.theme.read";
const THEME_WRITE = "system.theme.write";

const frames = new WeakMap();
const mounted = new Map();
const relays = new Map();
let bus = null;

export function attachBus(messageBus) {
  bus = messageBus;
}

function plugin() {
  const p = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins[PLUGIN_NAME];
  if (!p) throw new Error("MappSystem plugin is not available");
  return p;
}

export function originFor(appId) {
  return `https://miniapp-${appId}.local`;
}

function guarded(permission, fn) {
  return (params, ctx) => {
    if (!ctx.permissions.has(permission)) throw new Error("permission denied");
    return fn(params);
  };
}

const handlers = {
  "storage.getItem": (params, ctx) =>
    plugin().storageGetItem({ appId: ctx.appId, key: params.key }),
  "storage.setItem": (params, ctx) =>
    plugin().storageSetItem({ appId: ctx.appId, key: params.key, value: params.value }),
  "storage.removeItem": (params, ctx) =>
    plugin().storageRemoveItem({ appId: ctx.appId, key: params.key }),
  "storage.getKeys": (_params, ctx) =>
    plugin().storageGetKeys({ appId: ctx.appId }),
  "storage.clear": (_params, ctx) =>
    plugin().storageClear({ appId: ctx.appId }),
  // Токены активной темы. Раньше метод читал system_kv/theme/tokens — туда никто
  // не пишет, поэтому мини-приложения всегда получали пустой набор. Единственный
  // источник правды: active_theme в config плюс CSS этой темы в themes/<id>.
  "ui.getThemeTokens": async () => {
    const list = await plugin().themeGetList({});
    const themeId = list && list.activeThemeId;
    if (!themeId) return { tokens: {} };
    const res = await plugin().themeGetCss({ themeId });
    return { tokens: parseCssVariables(res && res.css) };
  },
  "theme.getList": guarded(THEME_READ, () => plugin().themeGetList({})),
  "theme.getCss": guarded(THEME_READ, (p) => plugin().themeGetCss({ themeId: p.themeId })),
  "theme.save": guarded(THEME_WRITE, (p) => plugin().themeSave({ themeId: p.themeId, css: p.css })),
  "theme.reset": guarded(THEME_WRITE, (p) => plugin().themeReset({ themeId: p.themeId })),
  "theme.apply": guarded(THEME_WRITE, (p) => plugin().themeApply({ themeId: p.themeId })),
  "bus.publish": (params, ctx) => bus.publish(ctx.appId, params),
  "bus.subscribe": (params, ctx) =>
    bus.subscribe({ appId: ctx.appId, iframe: ctx.iframe || null }, params.filter, { replay: !!params.replay }),
  "bus.unsubscribe": (params, ctx) => ({ ok: bus.unsubscribe(params.subId, ctx.appId) }),
};

async function onMessage(event) {
  const ctx = frames.get(event.source);
  if (!ctx || event.origin !== originFor(ctx.appId)) return;
  const data = event.data;
  if (!data || data.jsonrpc !== "2.0" || typeof data.method !== "string" || data.id === undefined) return;

  const handler = handlers[data.method];
  if (!handler) return;
  const reply = (body) => event.source.postMessage({ jsonrpc: "2.0", id: data.id, ...body }, event.origin);
  try {
    reply({ result: await handler(data.params || {}, ctx) });
  } catch (err) {
    reply({ error: { message: err && err.message ? err.message : String(err) } });
  }
}

export function isBridgeMethod(method) {
  return Object.prototype.hasOwnProperty.call(handlers, method);
}

export function invokeBridgeMethod(method, params, ctx) {
  return handlers[method](params, ctx);
}

export function mountMiniApp(iframe, appId, permissions = []) {
  const ctx = { appId, iframe, permissions: new Set(permissions) };
  frames.set(iframe.contentWindow, ctx);
  mounted.set(iframe, ctx);
}

export function unmountMiniApp(iframe) {
  const ctx = mounted.get(iframe);
  if (ctx) frames.delete(ctx.iframe.contentWindow);
  mounted.delete(iframe);
}

export function mountRelayed(hostIframe, hostAppId, appId) {
  relays.set(appId, { iframe: hostIframe, origin: originFor(hostAppId) });
}

export function unmountRelayed(appId) {
  relays.delete(appId);
}

export function deliverToApp(appId, event, payload) {
  const message = { __mapp_event__: true, event, payload, timestamp: Date.now() };
  for (const [iframe, ctx] of mounted) {
    if (ctx.appId !== appId) continue;
    if (!iframe.contentWindow) return false;
    iframe.contentWindow.postMessage(message, originFor(appId));
    return true;
  }
  const relay = relays.get(appId);
  if (!relay || !relay.iframe.contentWindow) return false;
  relay.iframe.contentWindow.postMessage({ __mapp_relay__: true, appId, message }, relay.origin);
  return true;
}

export function broadcastEvent(event, payload) {
  const appIds = new Set([...mounted.values()].map((ctx) => ctx.appId));
  for (const appId of relays.keys()) appIds.add(appId);
  for (const appId of appIds) deliverToApp(appId, event, payload);
}

export function startMappHostBridge() {
  window.addEventListener("message", onMessage);
  const p = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins[PLUGIN_NAME];
  if (!p) return;
  p.addListener("themeChanged", (payload) => {
    broadcastEvent("themeChanged", payload);
    window.dispatchEvent(new CustomEvent("mapp:event", { detail: { event: "themeChanged", payload } }));
  });
}
