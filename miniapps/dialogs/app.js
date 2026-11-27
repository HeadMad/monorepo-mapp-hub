(function () {
  const SHELL = "shell";
  const bus = MappHub.bus;
  const el = {
    modal: document.getElementById("system-modal"),
    title: document.getElementById("modal-title"),
    message: document.getElementById("modal-message"),
    checks: document.getElementById("modal-checks"),
    progress: document.getElementById("modal-progress"),
    progressBar: document.getElementById("modal-progress-bar"),
    actions: document.getElementById("modal-actions"),
    toast: document.getElementById("shell-toast"),
    installBar: document.getElementById("install-bar"),
    installFill: document.getElementById("install-bar-fill"),
    installText: document.getElementById("install-bar-text"),
    installPanel: document.getElementById("install-console"),
    installTitle: document.getElementById("install-console-title"),
    installLog: document.getElementById("install-log"),
    installClose: document.getElementById("install-console-close"),
    installCollapse: document.getElementById("install-console-collapse"),
  };
  const queue = [];
  let current = null;
  let toastTimer = null;
  let installExpanded = false;
  const INSTALL_BAR_TEXT = "Установка… нажмите, чтобы открыть лог";

  function send(type, data) {
    return bus.publish(type, data, { to: SHELL });
  }

  function resultOf(state, action) {
    const o = state.opts;
    return {
      action,
      checked: Object.fromEntries((o.checkboxes || []).map((c) => [c.id, !!c.checked])),
      radios: Object.fromEntries((o.radios || []).map((r) => [r.id, r.value])),
    };
  }

  function find(id) {
    if (current && current.id === id) return current;
    return queue.find((s) => s.id === id) || null;
  }

  function enqueue(id, opts) {
    const state = {
      id,
      opts: {
        ...opts,
        checkboxes: (opts.checkboxes || []).map((c) => ({ ...c })),
        radios: (opts.radios || []).map((r) => ({ ...r })),
      },
    };
    queue.push(state);
    if (!current) showNext();
  }

  function showNext() {
    current = queue.shift() || null;
    if (!current) {
      el.modal.style.display = "none";
      return;
    }
    render(current);
  }

  function finish(state, action) {
    const wasCurrent = current === state;
    if (wasCurrent) {
      current = null;
    } else {
      const index = queue.indexOf(state);
      if (index < 0) return;
      queue.splice(index, 1);
    }
    send("dialog.result", { id: state.id, result: resultOf(state, action) });
    if (wasCurrent) showNext();
  }

  function update(id, patch) {
    const state = find(id);
    if (!state) return;
    Object.assign(state.opts, patch);
    if (current === state) render(state);
  }

  function close(id) {
    const state = find(id);
    if (state) finish(state, "closed");
  }

  function toast({ message, duration }) {
    el.toast.textContent = message;
    el.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.toast.hidden = true;
    }, duration);
  }

  function setExpanded(value) {
    installExpanded = !!value;
    el.installPanel.hidden = !installExpanded;
    el.installCollapse.textContent = installExpanded ? "Свернуть" : "Развернуть";
    send("install.expanded", { value: installExpanded });
  }

  function showBar(visible) {
    el.installBar.hidden = !visible;
    document.body.classList.toggle("has-bar", visible);
  }

  function installStart({ title }) {
    showBar(true);
    setExpanded(false);
    el.installTitle.textContent = title || "Установка";
    el.installLog.textContent = "";
    el.installFill.style.width = "0%";
    el.installText.textContent = INSTALL_BAR_TEXT;
    el.installClose.hidden = true;
  }

  function installLog({ text }) {
    el.installLog.textContent += `${new Date().toLocaleTimeString()}  ${text}\n`;
    el.installLog.scrollTop = el.installLog.scrollHeight;
  }

  function installProgress({ name, percent }) {
    el.installFill.style.width = `${percent}%`;
    el.installText.textContent = `${name}: ${percent}%`;
  }

  function installFinish({ text }) {
    el.installFill.style.width = "100%";
    el.installText.textContent = `${text}. Откройте лог и нажмите «Закрыть»`;
    installLog({ text });
    el.installClose.hidden = false;
  }

  function installDismiss() {
    showBar(false);
    setExpanded(false);
    send("install.dismissed", {});
  }

  el.installBar.onclick = () => setExpanded(!installExpanded);
  el.installCollapse.onclick = () => setExpanded(!installExpanded);
  el.installClose.onclick = () => installDismiss();

  function render(state) {
    const o = state.opts;
    el.title.textContent = o.title || "";
    el.message.textContent = o.message || "";

    el.checks.innerHTML = "";
    for (const c of o.checkboxes) {
      const label = document.createElement("label");
      label.className = "modal-check";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = !!c.checked;
      input.disabled = !!c.disabled;
      input.onchange = () => {
        c.checked = input.checked;
        if (o.hasOnChange) send("dialog.change", { id: state.id, result: resultOf(state, null) });
      };
      const text = document.createElement("span");
      text.textContent = c.label;
      label.append(input, text);
      el.checks.append(label);
    }

    for (const r of o.radios || []) {
      const group = document.createElement("div");
      group.className = "modal-radio-group";
      for (const opt of r.options) {
        const label = document.createElement("label");
        label.className = "modal-check";
        const input = document.createElement("input");
        input.type = "radio";
        input.name = "radio-" + r.id;
        input.value = opt.value;
        input.checked = r.value === opt.value;
        input.onchange = () => {
          r.value = opt.value;
        };
        const text = document.createElement("span");
        text.textContent = opt.label;
        label.append(input, text);
        group.append(label);
      }
      el.checks.append(group);
    }

    if (typeof o.progress === "number") {
      el.progress.hidden = false;
      el.progressBar.style.width = Math.min(100, Math.max(0, o.progress)) + "%";
    } else {
      el.progress.hidden = true;
    }

    const buttons = o.buttons && o.buttons.length ? o.buttons : [{ id: "ok", text: "OK", primary: true }];
    el.actions.innerHTML = "";
    for (const b of buttons) {
      const btn = document.createElement("button");
      btn.textContent = b.text;
      btn.className = b.primary ? "btn-primary" : "btn-secondary";
      btn.disabled = !!b.disabled;
      btn.onclick = () => finish(state, b.id || "ok");
      el.actions.append(btn);
    }
    el.modal.style.display = "flex";
  }

  bus
    .subscribe({ type: "dialog.*" }, (msg) => {
      if (msg.app !== SHELL) return;
      const d = msg.data || {};
      if (msg.type === "dialog.open") enqueue(d.id, d.opts || {});
      else if (msg.type === "dialog.update") update(d.id, d.patch || {});
      else if (msg.type === "dialog.close") close(d.id);
      else if (msg.type === "dialog.toast") toast(d);
    })
    .then(() => bus.subscribe({ type: "install.*" }, (msg) => {
      if (msg.app !== SHELL) return;
      const d = msg.data || {};
      if (msg.type === "install.start") installStart(d);
      else if (msg.type === "install.log") installLog(d);
      else if (msg.type === "install.progress") installProgress(d);
      else if (msg.type === "install.finish") installFinish(d);
    }))
    .then(() => send("dialog.ready", {}));
})();
