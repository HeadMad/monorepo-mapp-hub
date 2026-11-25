import { SHELL_VERSION, compareVersions } from "../../version.js";
import { getSettings, setSettings } from "../../core/store.js";

const isNewer = (candidate, current) => !!candidate && compareVersions(candidate, current) > 0;

// Проверка обновления оболочки по release-manifest.json.
// params.silent = true: автопроверка при старте (уважает «Больше не показывать»).
// params.prompt = false: только вернуть результат без окна.
// params.includeBeta: переопределить галочку бета-канала.
export default async function (params = {}, context) {
  const settings = getSettings();
  const silent = params.silent === true;
  if (silent && settings.skipShellUpdatePrompt) {
    return { skipped: true, currentVersion: SHELL_VERSION };
  }

  const cfg = await fetch("shell-config.json", { cache: "no-store" }).then((r) => r.json());
  const res = await fetch(params.manifestUrl || cfg.manifestUrl, { cache: "no-store" });
  if (!res.ok) throw new Error(`Манифест релизов недоступен (HTTP ${res.status})`);
  const { shell } = await res.json();
  if (!shell) throw new Error("В манифесте релизов нет раздела shell");

  const includeBeta = params.includeBeta ?? settings.includeBeta;

  // Выбираем самую новую версию из доступных для канала. Бета учитывается только при включенной галочке.
  const pick = (beta) => {
    const candidates = [];
    if (isNewer(shell.version, SHELL_VERSION)) {
      candidates.push({ version: shell.version, url: shell.stableUrl, channel: "stable" });
    }
    if (beta && isNewer(shell.betaVersion, SHELL_VERSION)) {
      candidates.push({ version: shell.betaVersion, url: shell.betaUrl, channel: "beta" });
    }
    candidates.sort((a, b) => compareVersions(b.version, a.version));
    return candidates[0] || null;
  };

  const target = pick(includeBeta);
  const summary = (t, beta) => ({
    currentVersion: SHELL_VERSION,
    hasUpdate: !!t,
    targetVersion: t ? t.version : null,
    channel: t ? t.channel : null,
    includeBeta: beta,
  });

  const anyNewer = isNewer(shell.version, SHELL_VERSION) || isNewer(shell.betaVersion, SHELL_VERSION);
  if (params.prompt === false || (!target && (silent || !anyNewer))) return summary(target, includeBeta);

  const view = (beta) => {
    const t = pick(beta);
    if (!t) {
      return {
        title: "Обновлений нет",
        message: `Установлена версия ${SHELL_VERSION}. Для выбранного канала новых версий нет.`,
        buttons: [{ id: "close", text: "Закрыть", primary: true }],
      };
    }
    return {
      title: "Доступно обновление MappHub",
      message: `Текущая версия: ${SHELL_VERSION}\nНовая версия: ${t.version} (${t.channel === "beta" ? "бета" : "стабильная"})\n\n${shell.changelog || ""}`,
      buttons: [{ id: "later", text: "Позже" }, { id: "update", text: "Обновить", primary: true }],
    };
  };

  const handle = context.openModal({
    ...view(includeBeta),
    checkboxes: [
      { id: "beta", label: "Устанавливать бета-версии", checked: includeBeta },
      { id: "dismiss", label: "Больше не показывать это окно (и не проверять обновления)", checked: false },
    ],
    onChange: (checked, h) => h.update(view(checked.beta)),
  });
  const choice = await handle.promise;

  const beta = !!choice.checked.beta;
  setSettings({ includeBeta: beta, ...(choice.checked.dismiss ? { skipShellUpdatePrompt: true } : {}) });

  const t = pick(beta);
  if (choice.action !== "update" || !t) return { ...summary(t, beta), userAction: choice.action };

  // Внутри оболочки нельзя заменить APK самой себя: открываем ссылку на APK, дальше ставит системный установщик.
  const progress = context.openModal({
    title: "Загрузка MappHub",
    message: `Версия ${t.version} открыта для загрузки. Установите APK из загрузок поверх текущей версии, данные сохранятся.`,
    progress: 100,
    buttons: [{ id: "ok", text: "Готово", primary: true }],
  });
  const opened = window.open(t.url, "_blank");
  if (!opened) {
    progress.update({ message: `Не удалось открыть загрузку. Скачайте вручную: ${t.url}` });
  }
  return { ...summary(t, beta), userAction: "update", downloadUrl: t.url };
}
