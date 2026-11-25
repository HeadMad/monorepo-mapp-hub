import { compareVersions } from "../../version.js";
import { getInstalled, saveInstalled } from "../../core/store.js";

// Установка мини-приложения по mappmanifest.json.
// Шаг 1: список разрешений с галочками. Шаг 2 (если сняты галочки): предупреждение «Назад» / «Продолжить».
// «Назад» возвращает к шагу 1 с сохраненными галочками. Выданные разрешения пишутся в запись приложения.
export default async function (params = {}, context) {
  const manifest = params.manifest || (await loadManifest(params.manifestUrl));
  validate(manifest);

  const requested = manifest.permissions || [];
  const prior = getInstalled(manifest.id);
  const priorGranted = prior ? prior.permissions || [] : null;
  const checks = requested.map((p) => ({
    id: p,
    label: p,
    checked: priorGranted ? priorGranted.includes(p) : true,
  }));

  let granted = [];
  for (;;) {
    const step = await context.openModal({
      title: `Установка: ${manifest.name}`,
      message: `Версия ${manifest.version}\n\n` + (requested.length
        ? "Приложение запрашивает разрешения. Снимите галочки с тех, которые не хотите выдавать:"
        : "Особых разрешений не требуется."),
      checkboxes: checks,
      buttons: [{ id: "cancel", text: "Отмена" }, { id: "install", text: "Установить", primary: true }],
    }).promise;
    if (step.action !== "install") return { installed: false };

    for (const c of checks) c.checked = !!step.checked[c.id];
    granted = requested.filter((p) => step.checked[p]);
    if (granted.length === requested.length) break;

    const warn = await context.showModal({
      title: "Внимание: нет части разрешений",
      message: "Некоторые функции мини-приложения могут не работать без снятых разрешений.",
      buttons: [{ id: "back", text: "Назад" }, { id: "proceed", text: "Продолжить", primary: true }],
    });
    if (warn.action === "proceed") break;
  }

  if (manifest.archiveUrl) {
    const bar = context.openModal({
      title: `Загрузка: ${manifest.name}`,
      message: "Скачивание архива...",
      progress: 0,
      buttons: [{ id: "wait", text: "Загрузка...", disabled: true }],
    });
    try {
      const bytes = await downloadWithProgress(manifest.archiveUrl, (pct) =>
        bar.update({ progress: pct, message: `Скачивание... ${pct}%` }));
      bar.update({
        progress: 100,
        message: `Архив загружен (${Math.round(bytes / 1024)} КБ). Распаковка в каталог приложения пока не реализована, записан манифест.`,
        buttons: [{ id: "ok", text: "Готово", primary: true }],
      });
      await bar.promise;
    } catch (e) {
      bar.update({ message: `Ошибка загрузки: ${e.message}`, buttons: [{ id: "ok", text: "Закрыть", primary: true }] });
      await bar.promise;
      return { installed: false, error: e.message };
    }
  }

  saveInstalled({
    ...manifest,
    permissions: granted,
    requestedPermissions: requested,
    manifestUrl: params.manifestUrl || null,
    installedAt: new Date().toISOString(),
  });
  return { installed: true, appId: manifest.id, version: manifest.version, grantedPermissions: granted };
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
  compareVersions(m.version, "0.0.0"); // бросит ошибку, если версия не semver
}

async function downloadWithProgress(url, onProgress) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const total = Number(res.headers.get("content-length")) || 0;
  const reader = res.body.getReader();
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.length;
    if (total) onProgress(Math.round((received * 100) / total));
  }
  return received;
}
