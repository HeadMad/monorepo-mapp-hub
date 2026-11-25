class MappShellRuntime {
  constructor() {
    this.iframe = document.getElementById("app-frame");
    this.modalEl = document.getElementById("system-modal");
    this.modalTitle = document.getElementById("modal-title");
    this.modalMessage = document.getElementById("modal-message");
    this.modalActions = document.getElementById("modal-actions");

    window.addEventListener("message", (event) => this.onMessage(event));
    this.loadMiniApp("miniapps/launcher/index.html");
  }

  loadMiniApp(url) {
    this.iframe.src = url;
  }

  async onMessage(event) {
    const data = event.data;
    if (!data || data.jsonrpc !== "2.0" || !data.method) return;

    const { method, params, id } = data;
    try {
      const result = await this.handleRpcMethod(method, params || {});
      this.reply(event.source, { jsonrpc: "2.0", result, id });
    } catch (err) {
      this.reply(event.source, {
        jsonrpc: "2.0",
        error: { code: -32000, message: err.message || "Internal error" },
        id
      });
    }
  }

  async handleRpcMethod(method, params) {
    if (method === "shell.navigate") {
      this.loadMiniApp(params.url);
      return { success: true };
    }

    if (method === "shell.setTokens") {
      this.updateTokens(params.tokens || {});
      return { success: true };
    }

    const [category, action, ...rest] = method.split(".");
    if (!category || !action || rest.length) {
      throw new Error("Invalid method format. Use category.action");
    }

    let module;
    try {
      module = await import(`./api/${category}/${action}.js`);
    } catch (e) {
      throw new Error(`Method ${method} not found`);
    }
    if (typeof module.default !== "function") {
      throw new Error(`Method ${method} does not export a default function`);
    }
    return await module.default(params, { showModal: (opts) => this.showModal(opts) });
  }

  reply(target, response) {
    if (target && typeof target.postMessage === "function") {
      target.postMessage(response, "*");
    }
  }

  showModal({ title, message, buttons = [] }) {
    return new Promise((resolve) => {
      this.modalTitle.textContent = title;
      this.modalMessage.textContent = message;
      this.modalActions.innerHTML = "";

      const list = buttons.length ? buttons : [{ text: "OK", primary: true }];
      list.forEach((btn) => {
        const b = document.createElement("button");
        b.textContent = btn.text;
        b.className = btn.primary ? "btn-primary" : "btn-secondary";
        b.onclick = () => {
          this.hideModal();
          if (btn.callback) btn.callback();
          resolve();
        };
        this.modalActions.appendChild(b);
      });

      this.modalEl.style.display = "flex";
    });
  }

  hideModal() {
    this.modalEl.style.display = "none";
  }

  updateTokens(tokens) {
    const root = document.documentElement;
    Object.entries(tokens).forEach(([key, value]) => {
      root.style.setProperty(`--app-${key}`, value);
    });
    if (this.iframe.contentWindow) {
      this.iframe.contentWindow.postMessage({ type: "TOKENS_UPDATED", tokens }, "*");
    }
  }
}

window.shellRuntime = new MappShellRuntime();
