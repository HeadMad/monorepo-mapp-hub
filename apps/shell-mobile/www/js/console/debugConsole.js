const MAX_ENTRIES = 1000;
const COPY_FEEDBACK_MS = 1500;

const LEVEL_LABEL = { log: "LOG", info: "INFO", warn: "WARN", error: "ERROR", debug: "DEBUG" };

export function formatArgs(args) {
  return args
    .map((v) => {
      if (typeof v === "string") return v;
      if (v instanceof Error) return v.stack || `${v.name}: ${v.message}`;
      try {
        const s = JSON.stringify(v);
        return s === undefined ? String(v) : s;
      } catch {
        return String(v);
      }
    })
    .join(" ");
}

function sourceColor(source) {
  if (source === "shell") return "#14b8a6";
  let hash = 0;
  for (const ch of source) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return `hsl(${hash % 360} 60% 60%)`;
}

function formatTime(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export class DebugConsole {
  constructor(root) {
    this.root = root;
    this.head = root.querySelector("#dbg-head");
    this.countEl = root.querySelector("#dbg-count");
    this.copyBtn = root.querySelector("#dbg-copy");
    this.clearBtn = root.querySelector("#dbg-clear");
    this.list = root.querySelector("#dbg-list");
    this.entries = [];
    this.selected = new Set();
    this.seq = 0;
    this.open = false;
    this.visible = false;

    this.head.addEventListener("click", (e) => {
      if (!e.target.closest("button")) this.toggle();
    });
    this.copyBtn.addEventListener("click", () => this.copy());
    this.clearBtn.addEventListener("click", () => this.clear());
    document.addEventListener(
      "pointerdown",
      (e) => {
        if (this.open && !this.root.contains(e.target)) this.collapse();
      },
      true,
    );
    window.addEventListener("blur", () => this.collapse());

    this.applyVisibility();
    this.renderCount();
  }

  push(source, level, text) {
    const entry = {
      id: ++this.seq,
      ts: Date.now(),
      source,
      level: LEVEL_LABEL[level] ? level : "log",
      text: String(text),
    };
    this.entries.push(entry);
    if (this.entries.length > MAX_ENTRIES) {
      const dropped = this.entries.shift();
      this.selected.delete(dropped.id);
    }
    this.renderCount();
    if (this.open) this.appendRow(entry);
  }

  setVisible(visible) {
    this.visible = !!visible;
    if (!this.visible) this.collapse();
    this.applyVisibility();
  }

  getState() {
    return { visible: this.visible, open: this.open, count: this.entries.length };
  }

  toggle() {
    if (this.open) this.collapse();
    else this.expand();
  }

  expand() {
    if (this.open || !this.visible) return;
    this.open = true;
    this.root.classList.add("open");
    this.renderList();
  }

  collapse() {
    if (!this.open) return;
    this.open = false;
    this.root.classList.remove("open");
  }

  clear() {
    this.entries = [];
    this.selected.clear();
    this.renderCount();
    this.renderList();
  }

  applyVisibility() {
    this.root.hidden = !this.visible;
  }

  renderCount() {
    this.countEl.textContent = `Консоль · ${this.entries.length}`;
  }

  renderList() {
    this.list.replaceChildren(...this.entries.map((e) => this.createRow(e)));
    this.updateCopyLabel();
    this.list.scrollTop = this.list.scrollHeight;
  }

  appendRow(entry) {
    const stick = this.list.scrollTop + this.list.clientHeight >= this.list.scrollHeight - 24;
    this.list.append(this.createRow(entry));
    if (stick) this.list.scrollTop = this.list.scrollHeight;
  }

  createRow(entry) {
    const row = document.createElement("div");
    row.className = `dbg-row lvl-${entry.level}`;
    row.dataset.id = entry.id;
    if (this.selected.has(entry.id)) row.classList.add("selected");

    const time = document.createElement("span");
    time.className = "dbg-time";
    time.textContent = formatTime(entry.ts);

    const src = document.createElement("span");
    src.className = "dbg-src";
    src.style.setProperty("--src-color", sourceColor(entry.source));
    src.textContent = entry.source;

    const text = document.createElement("span");
    text.className = "dbg-text";
    text.textContent = entry.text;

    row.append(time, src, text);
    row.addEventListener("click", () => this.toggleSelect(entry.id, row));
    return row;
  }

  toggleSelect(id, row) {
    if (this.selected.has(id)) this.selected.delete(id);
    else this.selected.add(id);
    row.classList.toggle("selected", this.selected.has(id));
    this.updateCopyLabel();
  }

  updateCopyLabel() {
    if (this.copyBtn.dataset.flash) return;
    this.copyBtn.textContent = this.selected.size ? `Копировать (${this.selected.size})` : "Копировать";
  }

  selectedOrAll() {
    const pool = this.selected.size ? this.entries.filter((e) => this.selected.has(e.id)) : this.entries;
    return pool.map((e) => `${formatTime(e.ts)} [${e.source}] ${LEVEL_LABEL[e.level]}: ${e.text}`).join("\n");
  }

  async copy() {
    const text = this.selectedOrAll();
    if (!text) return this.flash("Пусто");
    const ok = await copyText(text);
    this.flash(ok ? "Скопировано" : "Ошибка");
  }

  flash(label) {
    const btn = this.copyBtn;
    btn.dataset.flash = "1";
    btn.textContent = label;
    clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => {
      delete btn.dataset.flash;
      this.updateCopyLabel();
    }, COPY_FEEDBACK_MS);
  }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}
