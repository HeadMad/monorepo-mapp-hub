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

  const permissions = appManifest.permissions || [];

  // Step 1: Permissions Selection Modal
  const getPermissionSelection = () => {
    return new Promise((resolve) => {
      let checkboxesHtml = permissions.length > 0 
        ? permissions.map(p => `<label style="display:block;margin:8px 0;cursor:pointer;"><input type="checkbox" checked value="${p}" class="perm-checkbox"> ${p}</label>`).join("")
        : "<p>No special permissions required.</p>";

      context.showModal({
        title: `Install ${appManifest.name}?`,
        message: `Version: ${appManifest.version}\n\nRequested Permissions:\n${checkboxesHtml}`,
        type: "custom",
        buttons: [
          { text: "Cancel", primary: false, callback: () => resolve({ installed: false }) },
          { text: "Install", primary: true, callback: () => {
            const checked = Array.from(document.querySelectorAll(".perm-checkbox:checked")).map(el => el.value);
            resolve({ installed: true, grantedPermissions: checked, allRequested: permissions });
          }}
        ]
      });
    });
  };

  let installResult = await getPermissionSelection();
  if (!installResult.installed) return { installed: false };

  // Check if any permissions were unchecked
  if (installResult.grantedPermissions.length < installResult.allRequested.length) {
    const confirmProceed = await new Promise((resolve) => {
      context.showModal({
        title: "Warning: Missing Permissions",
        message: "You have unchecked some permissions. Some features in this mini-app may not work correctly.",
        type: "confirm",
        buttons: [
          { text: "Back to Permissions", primary: false, callback: () => resolve(false) },
          { text: "Proceed Anyway", primary: true, callback: () => resolve(true) }
        ]
      });
    });

    if (!confirmProceed) {
      // Loop back recursively
      return await installWithPermissions(params, context);
    }
  }

  // Step 2: Download & Install with Progress Bar
  await context.showModal({
    title: `Installing ${appManifest.name}`,
    message: "Downloading archive... 0%",
    type: "progress",
    buttons: []
  });

  // Simulated download progress
  for (let i = 20; i <= 100; i += 20) {
    await new Promise(r => setTimeout(r, 300));
    context.updateModalMessage(`Downloading archive... ${i}%`);
  }

  localStorage.setItem("installed_app_" + appManifest.id, JSON.stringify({
    ...appManifest,
    grantedPermissions: installResult.grantedPermissions
  }));

  context.hideModal();
  return { installed: true, appId: appManifest.id, version: appManifest.version };
}
