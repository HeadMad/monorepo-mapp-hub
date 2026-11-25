(function () {
  const pending = new Map();
  const listeners = new Map();
  let seq = 0;

  function applyTokens(tokens) {
    const root = document.documentElement;
    for (const [name, value] of Object.entries(tokens || {})) {
      if (name.startsWith("--")) root.style.setProperty(name, String(value));
    }
  }

  function emit(name, params) {
    for (const fn of listeners.get(name) || []) fn(params);
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window.parent) return;
    const data = event.data;
    if (!data || data.jsonrpc !== "2.0") return;

    if (data.method === "event.themeChanged") {
      applyTokens(data.params && data.params.tokens);
      emit("themeChanged", data.params && data.params.tokens);
      return;
    }

    const entry = pending.get(data.id);
    if (!entry) return;
    pending.delete(data.id);
    if (data.error) entry.reject(new Error(data.error.message));
    else entry.resolve(data.result);
  });

  function call(method, params) {
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
      if (!listeners.has("themeChanged")) listeners.set("themeChanged", new Set());
      listeners.get("themeChanged").add(fn);
      return () => listeners.get("themeChanged").delete(fn);
    },
  };

  window.MappHub = { storage, ui };

  if (window.parent !== window) {
    ui.getThemeTokens().then(applyTokens).catch(() => {});
  }
})();
