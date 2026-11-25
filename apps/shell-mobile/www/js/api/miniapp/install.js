export default async function(params, context) {
  const { manifestUrl, manifest } = params;
  let appManifest = manifest;
  
  if (!appManifest && manifestUrl) {
    const res = await fetch(manifestUrl);
    appManifest = await res.json();
  }

  if (!appManifest) {
    throw new Error("Invalid mini-app manifest");
  }

  const permissionsList = (appManifest.permissions || []).join(", ") || "None";

  return new Promise((resolve) => {
    context.showModal({
      title: `Install ${appManifest.name}?`,
      message: `Version: ${appManifest.version}\nRequired Permissions:\n- ${permissionsList}\n\nDo you want to install this mini-application?`,
      type: "confirm",
      buttons: [
        { text: "Cancel", primary: false, callback: () => resolve({ installed: false }) },
        { text: "Install", primary: true, callback: () => {
          // Store installed mini-app metadata & cache archive
          localStorage.setItem("installed_app_" + appManifest.id, JSON.stringify(appManifest));
          resolve({ installed: true, appId: appManifest.id, version: appManifest.version });
        }}
      ]
    });
  });
}
