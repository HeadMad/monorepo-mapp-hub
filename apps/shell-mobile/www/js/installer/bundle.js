import { SHELL_VERSION } from "../version.js";
import { setSettings } from "../core/store.js";
import installMiniApp from "../api/miniapp/install.js";

export const LAUNCHER_ID = "com.mapphub.launcher";
const CATALOG_URL = `https://github.com/HeadMad/monorepo-mapp-hub/releases/download/v${SHELL_VERSION}/index.json`;
const BASE_MESSAGE = "Выберите приложения для установки. Приложение по умолчанию откроется при запуске.";
const SILENT_WARNING = "Тихая установка: все разрешения из манифестов будут выданы автоматически, без подтверждения.";

export async function runBundleInstall(context) {
  const catalog = (await loadCatalog(context)).filter((app) => !app.preinstalled);
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
  const ui = context.installUi;
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

export async function installCatalogApp(appId, context) {
  const catalog = await fetchCatalog();
  const app = catalog.find((item) => item.id === appId);
  if (!app) throw new Error(`${appId} нет в каталоге v${SHELL_VERSION}`);
  const choice = await context.showModal({
    title: "Приложение не установлено",
    message: `Для работы нужно приложение «${app.name}» ${app.version}. Установить?`,
    buttons: [{ id: "cancel", text: "Отмена" }, { id: "install", text: "Установить", primary: true }],
  });
  if (choice.action !== "install") throw new Error(`«${app.name}» не установлено`);
  const res = await installMiniApp({ manifest: app, archiveUrl: app.archiveUrl, sha256: app.sha256 }, context);
  if (!res.installed) throw new Error(`«${app.name}» не установлено`);
}

