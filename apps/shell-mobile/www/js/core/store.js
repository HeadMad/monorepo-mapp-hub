// Локальное хранилище оболочки: настройки и записи об установленных мини-приложениях.
const SETTINGS_KEY = "mapp_shell_settings";
const DEFAULT_SETTINGS = {
  includeBeta: false,            // устанавливать бета-версии оболочки
  skipShellUpdatePrompt: false,  // «Больше не показывать» для обновлений оболочки
  startAppId: null,              // мини-приложение, которое открывается при запуске оболочки
  skipAppUpdatePrompt: {},       // appId -> true, «Больше не показывать» для мини-приложений
};

export function getSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") };
  } catch (e) {
    return { ...DEFAULT_SETTINGS };
  }
}

export function setSettings(patch) {
  const next = { ...getSettings(), ...patch };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  return next;
}

export function getInstalled(appId) {
  const raw = localStorage.getItem("installed_app_" + appId);
  return raw ? JSON.parse(raw) : null;
}

export function saveInstalled(record) {
  localStorage.setItem("installed_app_" + record.id, JSON.stringify(record));
}
