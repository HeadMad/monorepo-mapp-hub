(function () {
  const pending = new Map();
  const listeners = new Map();
  const exposed = {};
  const fnRefs = new Map();
  let seq = 0;
  let fnSeq = 0;

  // Токены, которые SDK выставил инлайново на <html>. Инлайн сильнее любого
  // stylesheet, поэтому набор надо держать в актуальном состоянии: значения,
  // которых нет в новой теме, снимаются, иначе они «залипают» после переключения.
  const appliedTokens = new Set();

  function applyTokens(tokens) {
    const root = document.documentElement;
    const next = new Set();
    for (const [name, value] of Object.entries(tokens || {})) {
      if (!name.startsWith("--")) continue;
      root.style.setProperty(name, String(value));
      next.add(name);
    }
    for (const name of appliedTokens) {
      if (!next.has(name)) root.style.removeProperty(name);
    }
    appliedTokens.clear();
    for (const name of next) appliedTokens.add(name);
  }

  // Разбор CSS темы в пары "--name: value". Копия
  // apps/shell-mobile/www/js/core/cssTokens.js: SDK уезжает в архив мини-приложения
  // и не может импортировать код оболочки, поэтому обе реализации проверяются
  // одним тестом на одинаковый результат.
  function parseCssVariables(css) {
    const tokens = {};
    if (typeof css !== "string") return tokens;
    const open = css.indexOf("{");
    const close = css.lastIndexOf("}");
    if (open < 0 || close <= open) return tokens;
    for (const declaration of css.slice(open + 1, close).split(";")) {
      const colon = declaration.indexOf(":");
      if (colon <= 0) continue;
      const name = declaration.slice(0, colon).trim();
      const value = declaration.slice(colon + 1).trim();
      if (!/^--[A-Za-z0-9_-]{1,64}$/.test(name)) continue;
      if (!value || /[{}<>]/.test(value)) continue;
      tokens[name] = value;
    }
    return tokens;
  }

  // Второй канал доставки темы: даже если https://mapp.local/theme.css не
  // загрузился (404, ошибка генератора, гонка при старте), значения приходят
  // по мосту и выставляются инлайново.
  async function refreshThemeTokens() {
    try {
      const tokens = await ui.getThemeTokens();
      applyTokens(tokens);
      emit("themeTokens", tokens);
      return tokens;
    } catch (err) {
      return {};
    }
  }

  function emit(name, payload) {
    for (const fn of [...(listeners.get(name) || [])]) {
      try {
        fn(payload);
      } catch (err) {
        console.error(err);
      }
    }
  }

  function on(name, fn) {
    if (!listeners.has(name)) listeners.set(name, new Set());
    listeners.get(name).add(fn);
    return () => off(name, fn);
  }

  function off(name, fn) {
    const set = listeners.get(name);
    if (set) set.delete(fn);
  }

  function once(name, fn) {
    const unsubscribe = on(name, (payload) => {
      unsubscribe();
      fn(payload);
    });
    return unsubscribe;
  }

  function reloadThemeCss() {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://mapp.local/theme.css?v=${Date.now()}`;
    link.onload = () => {
      document.querySelectorAll("#mapp-theme-css").forEach((node) => node.remove());
      link.id = "mapp-theme-css";
    };
    link.onerror = () => link.remove();
    const current = document.getElementById("mapp-theme-css");
    if (current) current.after(link);
    else document.head.append(link);
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window.parent) return;
    const data = event.data;
    if (!data || typeof data !== "object") return;

    if (data.__mapp_invoke__ === true) {
      handleInvoke(data);
      return;
    }

    if (data.__mapp_event__ === true) {
      if (data.event === "themeChanged") {
        reloadThemeCss();
        refreshThemeTokens();
      }
      if (data.event === "bus.message") {
        deliverBus(data.payload);
        return;
      }
      emit(data.event, data.payload);
      return;
    }

    if (data.jsonrpc !== "2.0") return;
    const entry = pending.get(data.id);
    if (!entry) return;
    pending.delete(data.id);
    if (data.error) entry.reject(new Error(data.error.message));
    else entry.resolve(data.result);
  });

  function call(method, params) {
    if (window.parent === window) {
      return Promise.reject(new Error("MappHub is available only inside the shell"));
    }
    return new Promise((resolve, reject) => {
      const id = "req_" + ++seq;
      pending.set(id, { resolve, reject });
      window.parent.postMessage({ jsonrpc: "2.0", method, params: params || {}, id }, "*");
    });
  }

  const storage = {
    async getItem(key) {
      const res = await call("storage.getItem", { key });
      return res.value == null ? null : JSON.parse(res.value);
    },
    setItem(key, value) {
      return call("storage.setItem", { key, value: JSON.stringify(value) });
    },
    removeItem(key) {
      return call("storage.removeItem", { key });
    },
    async getKeys() {
      const res = await call("storage.getKeys");
      return res.keys;
    },
    clear() {
      return call("storage.clear");
    },
  };

  const ui = {
    async getThemeTokens() {
      const res = await call("ui.getThemeTokens");
      return res.tokens || {};
    },
    onThemeChanged(fn) {
      return on("themeChanged", fn);
    },
  };

  const theme = {
    getList() {
      return call("theme.getList");
    },
    async getCss(themeId) {
      const res = await call("theme.getCss", { themeId });
      return res.css;
    },
    save(themeId, css) {
      return call("theme.save", { themeId, css });
    },
    reset(themeId) {
      return call("theme.reset", { themeId });
    },
    apply(themeId) {
      return call("theme.apply", { themeId });
    },
  };

  function serialize(value) {
    if (typeof value === "function") {
      const ref = `fn_${++fnSeq}_${Math.random().toString(36).slice(2, 8)}`;
      fnRefs.set(ref, value);
      return { __mapp_fn__: ref };
    }
    if (Array.isArray(value)) return value.map(serialize);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, serialize(v)]));
    }
    return value;
  }

  function revive(value, from) {
    if (Array.isArray(value)) return value.map((v) => revive(v, from));
    if (value && typeof value === "object") {
      if (typeof value.__mapp_fn__ === "string") {
        const ref = value.__mapp_fn__;
        return (...args) => invoke(from, "__mapp_fn__", { ref, args });
      }
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, revive(v, from)]));
    }
    return value;
  }

  function invoke(appId, method, params = {}) {
    return call("miniapp.invoke", { appId, method, params: serialize(params) });
  }

  function expose(methods) {
    Object.assign(exposed, methods);
  }

  async function handleInvoke({ id, from, method, params }) {
    const reply = (body) => window.parent.postMessage({ jsonrpc: "2.0", id, ...body }, "*");
    try {
      let result;
      if (method === "__mapp_fn__") {
        const fn = fnRefs.get(params.ref);
        if (!fn) throw new Error("Callback is no longer available");
        result = await fn(...(params.args || []));
      } else {
        if (!Object.prototype.hasOwnProperty.call(exposed, method)) {
          throw new Error(`Method ${method} is not exposed`);
        }
        result = await exposed[method](revive(params, from));
      }
      reply({ result: result === undefined ? null : result });
    } catch (err) {
      reply({ error: { message: err && err.message ? err.message : String(err) } });
    }
  }

  const busHandlers = new Map();
  const busEarly = new Map();

  function deliverBus({ subId, message }) {
    const fn = busHandlers.get(subId);
    if (fn) fn(message);
    else if (busEarly.has(subId)) busEarly.get(subId).push(message);
    else busEarly.set(subId, [message]);
  }

  const bus = {
    publish(type, data, opts = {}) {
      return call("bus.publish", { type, data, to: opts.to });
    },
    async subscribe(filter, fn, opts = {}) {
      const { subId, replay } = await call("bus.subscribe", { filter, replay: !!opts.replay });
      busHandlers.set(subId, fn);
      for (const message of [...replay, ...(busEarly.get(subId) || [])]) fn(message);
      busEarly.delete(subId);
      return () => {
        busHandlers.delete(subId);
        return call("bus.unsubscribe", { subId });
      };
    },
  };

  function formatArg(value) {
    if (typeof value === "string") return value;
    if (value instanceof Error) return value.stack || `${value.name}: ${value.message}`;
    try {
      const json = JSON.stringify(value);
      return json === undefined ? String(value) : json;
    } catch (e) {
      return String(value);
    }
  }

  function forwardLog(level, args) {
    if (window.parent === window) return;
    const text = args.map(formatArg).join(" ").slice(0, 8000);
    call("bus.publish", { type: `console.${level}`, data: { text, ts: Date.now() } }).catch(() => {});
  }

  for (const level of ["log", "info", "warn", "error", "debug"]) {
    const original = console[level].bind(console);
    console[level] = (...args) => {
      original(...args);
      forwardLog(level, args);
    };
  }

  window.addEventListener("error", (event) => {
    forwardLog("error", [`${event.message} (${event.filename}:${event.lineno})`]);
  });
  window.addEventListener("unhandledrejection", (event) => {
    forwardLog("error", [event.reason]);
  });

  window.MappHub = {
    call,
    invoke,
    expose,
    storage,
    ui,
    theme,
    bus,
    events: { on, off, once },
    reloadThemeCss,
    refreshThemeTokens,
  };

  if (window.parent !== window) {
    refreshThemeTokens();
  }
})();
