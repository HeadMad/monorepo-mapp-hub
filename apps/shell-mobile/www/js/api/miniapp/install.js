import { compareVersions } from "../../version.js";
import { getInstalled, saveInstalled } from "../../core/store.js";

// Установка мини-приложения: разрешения (галочками или автоматически в тихом режиме),
// затем загрузка архива в нативный слой с проверкой SHA-256.
export default async function (params = {}, context) {
  const log = params.log || (() => {});
  const manifest = params.manifest || (await loadManifest(params.manifestUrl));
  validate(manifest);

  const requested = manifest.permissions || [];
  const granted = params.silent ? requested : await askPermissions(manifest, requested, context);
  if (!granted) return { installed: false };
  log(`разрешения: ${granted.length ? granted.join(", ") : "нет"}`);

  const archiveUrl = params.archiveUrl || manifest.archiveUrl;
  if (!archiveUrl) throw new Error(`для ${manifest.id} не задан архив`);
  log("загрузка архива");
  await window.Capacitor.Plugins.MappSystem.installMiniAppArchive({
    appId: manifest.id,
    version: manifest.version,
    name: manifest.name,
    archiveUrl,
    sha256: params.sha256 || null,
    manifestJson: JSON.stringify(manifest),
  });
  log("архив распакован и проверен");

  saveInstalled({
    ...manifest,
    permissions: granted,
    requestedPermissions: requested,
    manifestUrl: params.manifestUrl || null,
    installedAt: new Date().toISOString(),
  });
  return { installed: true, appId: manifest.id, version: manifest.version, grantedPermissions: granted };
}

async function askPermissions(manifest, requested, context) {
  const prior = getInstalled(manifest.id);
  const priorGranted = prior ? prior.permissions || [] : null;
  const checks = requested.map((p) => ({
    id: p,
    label: p,
    checked: priorGranted ? priorGranted.includes(p) : true,
  }));

  for (;;) {
    const step = await context.openModal({
      title: `Установка: ${manifest.name}`,
      message: `Версия ${manifest.version}\n\n` + (requested.length
        ? "Приложение запрашивает разрешения. Снимите галочки с тех, которые не хотите выдавать:"
        : "Особых разрешений не требуется."),
      checkboxes: checks,
      buttons: [{ id: "cancel", text: "Отмена" }, { id: "install", text: "Установить", primary: true }],
    }).promise;
    if (step.action !== "install") return null;

    for (const c of checks) c.checked = !!step.checked[c.id];
    const granted = requested.filter((p) => step.checked[p]);
    if (granted.length === requested.length) return granted;

    const warn = await context.showModal({
      title: "Внимание: нет части разрешений",
      message: "Некоторые функции мини-приложения могут не работать без снятых разрешений.",
      buttons: [{ id: "back", text: "Назад" }, { id: "proceed", text: "Продолжить", primary: true }],
    });
    if (warn.action === "proceed") return granted;
  }
}

async function loadManifest(url) {
  if (!url) throw new Error("Нужен параметр manifest или manifestUrl");
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Манифест недоступен (HTTP ${res.status})`);
  return res.json();
}

function validate(m) {
  if (!m || typeof m !== "object") throw new Error("Манифест пуст или не является объектом");
  for (const key of ["id", "name", "version"]) {
    if (typeof m[key] !== "string" || !m[key]) throw new Error(`В манифесте нет поля ${key}`);
  }
  if (m.permissions && !Array.isArray(m.permissions)) throw new Error("permissions должен быть массивом");
  compareVersions(m.version, "0.0.0");
}
