import { compareVersions } from "../../version.js";
import { getInstalled, getSettings, setSettings } from "../../core/store.js";

// Проверка обновления для вызывающего мини-приложения (context.appId).
// Сравнивает версию из установленной записи с версией в удаленном манифесте и при необходимости
// открывает окно «Обновить / Позже». «Обновить» запускает miniapp.install с новым манифестом.
export default async function (params = {}, context) {
  const appId = context.appId;
  if (!appId) throw new Error("Вызов не из установленного мини-приложения");
  const rec = getInstalled(appId);
  if (!rec) throw new Error("Мини-приложение не установлено");

  const settings = getSettings();
  if (settings.skipAppUpdatePrompt[appId]) return { skipped: true, appId, currentVersion: rec.version };

  const url = params.manifestUrl || rec.manifestUrl;
  if (!url) throw new Error("У приложения нет manifestUrl для проверки обновлений");
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Манифест недоступен (HTTP ${res.status})`);
  const remote = await res.json();
  if (!remote.version) throw new Error("В удаленном манифесте нет version");
  if (remote.id !== appId) throw new Error("Манифест относится к другому приложению");

  const hasUpdate = compareVersions(remote.version, rec.version) > 0;
  const result = {
    appId,
    currentVersion: rec.version,
    targetVersion: remote.version,
    hasUpdate,
    changelog: remote.changelog || "",
  };
  if (!hasUpdate || params.prompt === false) return result;

  const handle = context.openModal({
    title: `Обновление: ${rec.name}`,
    message: `Установлена версия ${rec.version}, доступна ${remote.version}.\n\n${remote.changelog || ""}`,
    checkboxes: [{ id: "dismiss", label: "Больше не показывать для этого приложения", checked: false }],
    buttons: [{ id: "later", text: "Позже" }, { id: "update", text: "Обновить", primary: true }],
  });
  const choice = await handle.promise;

  if (choice.checked.dismiss) {
    setSettings({ skipAppUpdatePrompt: { ...getSettings().skipAppUpdatePrompt, [appId]: true } });
  }
  if (choice.action === "update") {
    const install = await context.install({ manifest: remote, manifestUrl: url });
    return { ...result, userAction: "update", installed: !!install.installed };
  }
  return { ...result, userAction: choice.action };
}
