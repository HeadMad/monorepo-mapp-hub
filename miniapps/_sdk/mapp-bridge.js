(function () {
  const pending = new Map();
  let seq = 0;

  window.addEventListener("message", (event) => {
    const data = event.data;
    if (event.source !== window.parent || !data || data.jsonrpc !== "2.0") return;
    const resolve = pending.get(data.id);
    if (!resolve) return;
    pending.delete(data.id);
    resolve(data.error
      ? { ok: false, message: data.error.message }
      : { ok: true, result: data.result });
  });

  function call(method, params) {
    return new Promise((resolve) => {
      const id = "req_" + ++seq;
      pending.set(id, resolve);
      window.parent.postMessage({ jsonrpc: "2.0", method, params, id }, "*");
    });
  }

  window.MappHub = new Proxy({}, {
    get(_, category) {
      if (typeof category !== "string" || category === "then") return undefined;
      return (action, params = {}) => call(`${category}.${action}`, params);
    }
  });
})();
