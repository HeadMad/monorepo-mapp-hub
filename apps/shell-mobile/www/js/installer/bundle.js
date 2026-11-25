import { SHELL_VERSION } from "../version.js";
import { setSettings } from "../core/store.js";
import installMiniApp from "../api/miniapp/install.js";

export const LAUNCHER_ID = "com.mapphub.launcher";
const CATALOG_URL = `https://github.com/HeadMad/monorepo-mapp-hub/releases/download/v${SHELL_VERSION}/index.json`;
const BASE_MESSAGE = "Выберите приложения для установки. Приложение по умолчанию откроется при запуске.";
const SILENT_WARNING = "Тихая установка: все разрешения из манифестов будут выданы автоматически, без подтверждения.";

let consoleUi = null;

export async function runBundleInstall(context) {
  const catalog = await loadCatalog(context);
  const choice = await context.openModal({
    title: "Установка мини-приложений",
    message: BASE_MESSAGE,
    checkboxes: [
      ...catalog.map((app) => ({ id: app.id, label: `${app.name} ${app.version}`, checked: true })),
      { id: "silent", label: "Тихая установка", checked: false },
    ],
    radios: [{ id: "startApp", value: LAUNCHER_ID, options: catalog.map((app) => ({ value: app.id, label: app.name })) }],
    onChange: (result, handle) =>
      handle.update({ message: result.checked.silent ? `${BASE_MESSAGE}\n\n${SILENT_WARNING}` : BASE_MESSAGE }),
    buttons: [{ id: "cancel", text: "Отмена" }, { id: "install", text: "Установить", primary: true }],
  }).promise;
  if (choice.action !== "install") return false;

  const selected = catalog.filter((app) => choice.checked[app.id]);
  if (!selected.length) return false;
  const silent = !!choice.checked.silent;
  const ui = getConsole();
  const names = Object.fromEntries(selected.map((app) => [app.id, app.name]));
  ui.start(`Установка: ${selected.length} шт.`);
  ui.log(`Тихая установка: ${silent ? "да" : "нет"}`);

  const plugin = window.Capacitor.Plugins.MappSystem;
  const listener = await plugin.addListener("miniAppInstallProgress", (e) =>
    ui.progress(names[e.appId] || e.appId, e.percent));
  const installed = [];
  try {
    for (const app of selected) {
      ui.log(`→ ${app.name} ${app.version}`);
      try {
        const res = await installMiniApp(
          { manifest: app, archiveUrl: app.archiveUrl, sha256: app.sha256, silent, log: (m) => ui.log(`  ${m}`) },
          context,
        );
        if (res.installed) {
          installed.push(app.id);
          ui.log("  установлено");
        } else {
          ui.log("  пропущено");
        }
      } catch (e) {
        ui.log(`  ошибка: ${e.message}`);
      }
    }
  } finally {
    await listener.remove();
  }

  if (installed.length) {
    const startId = installed.includes(choice.radios.startApp) ? choice.radios.startApp : installed[0];
    setSettings({ startAppId: startId });
  }
  ui.finish(installed.length
    ? `Готово: установлено ${installed.length} из ${selected.length}`
    : "Ничего не установлено");
  return installed.length > 0;
}

async function loadCatalog(context) {
  for (;;) {
    try {
      return await fetchCatalog();
    } catch (e) {
      await context.showModal({
        title: "Каталог недоступен",
        message: e.message,
        buttons: [{ id: "retry", text: "Повторить", primary: true }],
      });
    }
  }
}

async function fetchCatalog() {
  const { body } = await window.Capacitor.Plugins.MappSystem.fetchMiniAppCatalog({ url: CATALOG_URL });
  const { apps } = JSON.parse(body);
  return apps.map((app) => ({ ...app, archiveUrl: new URL(app.archive, CATALOG_URL).href }));
}

function getConsole() {
  if (!consoleUi) consoleUi = new InstallConsole();
  return consoleUi;
}

class InstallConsole {
  constructor() {
    this.bar = document.getElementById("install-bar");
    this.fill = document.getElementById("install-bar-fill");
    this.barText = document.getElementById("install-bar-text");
    this.panel = document.getElementById("install-console");
    this.title = document.getElementById("install-console-title");
    this.logEl = document.getElementById("install-log");
    this.closeBtn = document.getElementById("install-console-close");
    this.bar.onclick = () => this.setOpen(this.panel.hidden);
    this.closeBtn.onclick = () => this.dismiss();
    window.addEventListener("blur", () => this.setOpen(false));
  }

  start(title) {
    this.title.textContent = title;
    this.logEl.textContent = "";
    this.fill.style.width = "0%";
    this.barText.textContent = "Установка... нажмите, чтобы открыть лог";
    this.closeBtn.hidden = true;
    this.bar.hidden = false;
  }

  setOpen(open) {
    this.panel.hidden = !open;
  }

  log(message) {
    this.logEl.textContent += `${new Date().toLocaleTimeString()}  ${message}\n`;
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }

  progress(name, percent) {
    this.fill.style.width = `${percent}%`;
    this.barText.textContent = `${name}: ${percent}%`;
  }

  finish(text) {
    this.fill.style.width = "100%";
    this.barText.textContent = `${text}. Откройте лог и нажмите «Закрыть»`;
    this.log(text);
    this.closeBtn.hidden = false;
  }

  dismiss() {
    this.bar.hidden = true;
    this.setOpen(false);
  }
}
