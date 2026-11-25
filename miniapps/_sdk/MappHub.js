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

    if (data.__mapp_event__ === true) {
      if (data.event === "themeChanged") reloadThemeCss();
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

  window.MappHub = {
    call,
    storage,
    ui,
    theme,
    events: { on, off, once },
    reloadThemeCss,
  };

  if (window.parent !== window) {
    ui.getThemeTokens().then(applyTokens).catch(() => {});
  }
})();
