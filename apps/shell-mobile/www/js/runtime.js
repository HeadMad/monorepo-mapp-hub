class MappShellRuntime {
  constructor() {
    this.iframe = document.getElementById("app-frame");
    this.modalEl = document.getElementById("system-modal");
    this.modalTitle = document.getElementById("modal-title");
    this.modalMessage = document.getElementById("modal-message");
    this.modalActions = document.getElementById("modal-actions");
    this.currentAppId = null;

    window.addEventListener("message", (event) => this.onMessage(event));
    this.loadMiniApp("miniapps/launcher/index.html", "com.mapphub.launcher");
  }

  loadMiniApp(url, appId = null) {
    this.currentAppId = appId;
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
      this.loadMiniApp(params.url, params.appId || null);
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

    const fullMethod = `${category}.${action}`;
    await this.verifyPermission(fullMethod);

    let module;
    try {
      module = await import(`./api/${category}/${action}.js`);
    } catch (e) {
      throw new Error(`Method ${fullMethod} not found`);
    }
    if (typeof module.default !== "function") {
      throw new Error(`Method ${fullMethod} does not export a default function`);
    }
    return await module.default(params, { showModal: (opts) => this.showModal(opts) });
  }

  async verifyPermission(method) {
    const permissionMap = {
      "device.info": "device.info",
      "miniapp.install": "miniapps.install",
      "shell.setTokens": "shell.tokens"
    };

    const requiredPerm = permissionMap[method];
    if (!requiredPerm) return;

    if (!this.currentAppId) return;

    const raw = localStorage.getItem("installed_app_" + this.currentAppId);
    if (!raw) return;

    const manifest = JSON.parse(raw);
    const granted = manifest.permissions || [];

    if (granted.includes(requiredPerm)) return;

    await new Promise((resolve, reject) => {
      let checkboxesHtml = (manifest.permissions || []).length > 0
        ? (manifest.permissions || []).map(p => `<label style="display:block;margin:6px 0;"><input type="checkbox" checked disabled> ${p}</label>`).join("")
        : "<p>Нет активных разрешений.</p>";

      checkboxesHtml += `<label style="display:block;margin:6px 0;color:var(--app-primary);font-weight:bold;"><input type="checkbox" id="add-missing-perm" checked value="${requiredPerm}"> Добавить требуемое: ${requiredPerm}</label>`;

      this.showModal({
        title: "Требуется разрешение",
        message: `Мини-приложению (${manifest.name || this.currentAppId}) нужен доступ к: ${requiredPerm}.\n\nТекущие и запрашиваемые права:\n${checkboxesHtml}`,
        type: "custom",
        buttons: [
          { text: "Отмена", primary: false, callback: () => reject(new Error(`Permission denied: ${requiredPerm} required`)) },
          { text: "Разрешить", primary: true, callback: () => {
            const addCheckbox = document.getElementById("add-missing-perm");
            if (addCheckbox && addCheckbox.checked) {
              if (!manifest.permissions.includes(requiredPerm)) {
                manifest.permissions.push(requiredPerm);
              }
              localStorage.setItem("installed_app_" + this.currentAppId, JSON.stringify(manifest));
            }
            resolve();
          }}
        ]
      });
    });
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
