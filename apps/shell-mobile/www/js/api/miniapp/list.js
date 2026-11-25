// Список установленных мини-приложений из нативного реестра.
export default async function () {
  const { apps } = await window.Capacitor.Plugins.MappSystem.getInstalledApps();
  return {
    apps: apps.map((row) => {
      const manifest = parseManifest(row.manifestJson);
      return {
        id: row.appId,
        name: row.name,
        version: row.activeVersion,
        icon: manifest.icon || null,
        service: manifest.service === true,
      };
    }),
  };
}

function parseManifest(json) {
  try {
    return json ? JSON.parse(json) : {};
  } catch (e) {
    return {};
  }
}
