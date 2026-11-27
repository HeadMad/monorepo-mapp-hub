export const BUFFER_SIZE = 500;
export const MAX_DATA_BYTES = 10 * 1024;
export const CONSOLE_ID = "com.mapphub.console";
export const DIALOGS_ID = "com.mapphub.dialogs";
export const SHELL_ID = "shell";

function rpcError(code, message) {
  return Object.assign(new Error(message), { code });
}

function typeMatches(pattern, type) {
  if (pattern.endsWith("*")) return type.startsWith(pattern.slice(0, -1));
  return pattern === type;
}

function matchesFilter(filter, message) {
  if (filter.type !== undefined && !typeMatches(filter.type, message.type)) return false;
  if (filter.app !== undefined && filter.app !== message.app) return false;
  return true;
}

function visibleTo(message, appId) {
  return message.to === undefined || message.to === appId;
}

function newId() {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export class MessageBus {
  constructor(deliver) {
    this.deliver = deliver;
    this.buffer = [];
    this.subs = new Map();
    this.seq = 0;
  }

  publish(app, { type, data, to } = {}) {
    if (typeof type !== "string" || !type || type.length > 128) {
      throw rpcError(-32602, "Некорректный type");
    }
    if (to !== undefined && (typeof to !== "string" || !to)) {
      throw rpcError(-32602, "Некорректный to");
    }
    const body = data === undefined ? null : data;
    if (new TextEncoder().encode(JSON.stringify(body)).length > MAX_DATA_BYTES) {
      throw rpcError(-32602, "data больше 10 КБ");
    }

    const message = { type, data: body, app, id: newId() };
    if (to !== undefined) message.to = to;
    if (app === CONSOLE_ID && type.startsWith("console.")) return { id: message.id };

    this.buffer.push(message);
    if (this.buffer.length > BUFFER_SIZE) this.buffer.shift();

    for (const sub of [...this.subs.values()]) {
      if (!visibleTo(message, sub.appId) || !matchesFilter(sub.filter, message)) continue;
      if (!this.deliver(sub, message)) this.subs.delete(sub.subId);
    }
    return { id: message.id };
  }

  subscribe(target, filter = {}, { replay = false } = {}) {
    if (filter === null || typeof filter !== "object") throw rpcError(-32602, "filter должен быть объектом");
    for (const key of ["type", "app"]) {
      if (filter[key] !== undefined && typeof filter[key] !== "string") {
        throw rpcError(-32602, `filter.${key} должен быть строкой`);
      }
    }
    const sub = {
      subId: `sub_${++this.seq}`,
      appId: target.appId,
      filter: { type: filter.type, app: filter.app },
      target,
    };
    this.subs.set(sub.subId, sub);
    const replayed = replay
      ? this.buffer.filter((m) => visibleTo(m, sub.appId) && matchesFilter(sub.filter, m))
      : [];
    return { subId: sub.subId, replay: replayed };
  }

  unsubscribe(subId, appId) {
    const sub = this.subs.get(subId);
    if (!sub || sub.appId !== appId) return false;
    this.subs.delete(subId);
    return true;
  }

  dropFrame(iframe) {
    for (const [subId, sub] of this.subs) {
      if (sub.target.iframe === iframe) this.subs.delete(subId);
    }
  }
}
