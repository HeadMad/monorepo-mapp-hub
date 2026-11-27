import { compareVersions } from "../version.js";
import { getInstalled, saveInstalled } from "../core/store.js";

export async function installPreinstalled() {
  const res = await fetch("preinstalled/index.json", { cache: "no-store" });
  if (!res.ok) throw new Error("preinstalled/index.json недоступен");
  const { apps } = await res.json();
  const plugin = window.Capacitor.Plugins.MappSystem;
  for (const app of apps) {
    const prior = getInstalled(app.id);
    if (prior && compareVersions(prior.version, app.version) >= 0) continue;
    await plugin.installMiniAppArchive({
      appId: app.id,
      version: app.version,
      name: app.name,
      archiveAsset: `preinstalled/${app.archive}`,
      sha256: app.sha256,
      manifestJson: JSON.stringify(app),
    });
    saveInstalled({
      ...app,
      requestedPermissions: app.permissions,
      permissions: app.permissions,
      preinstalled: true,
      installedAt: new Date().toISOString(),
    });
  }
}
