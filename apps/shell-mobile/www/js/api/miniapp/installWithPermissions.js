export default async function(params, context) {
  const { manifestUrl, manifest, appId: existingAppId } = params;
  let appManifest = manifest;
  
  if (!appManifest && manifestUrl) {
    const res = await fetch(manifestUrl);
    appManifest = await res.json();
  }

  if (!appManifest) {
    throw new Error("Invalid mini-app manifest");
  }

  const permissions = appManifest.permissions || [];

  const getPermissionSelection = () => {
    return new Promise((resolve) => {
      let checkboxesHtml = permissions.length > 0 
        ? permissions.map(p => `<label style="display:block;margin:8px 0;cursor:pointer;"><input type="checkbox" checked value="${p}" class="perm-checkbox"> ${p}</label>`).join("")
        : "<p>No special permissions required.</p>";

      context.showModal({
        title: `Установка ${appManifest.name}?`,
        message: `Версия: ${appManifest.version}\n\nЗапрашиваемые разрешения:\n${checkboxesHtml}`,
        type: "custom",
        buttons: [
          { text: "Отмена", primary: false, callback: () => resolve({ installed: false }) },
          { text: "Установить", primary: true, callback: () => {
            const checked = Array.from(document.querySelectorAll(".perm-checkbox:checked")).map(el => el.value);
            resolve({ installed: true, grantedPermissions: checked, allRequested: permissions });
          }}
        ]
      });
    });
  };

  const installResult = await getPermissionSelection();
  if (!installResult.installed) return { installed: false };

  // Если убрали какие-то галочки, спрашиваем
  if (installResult.grantedPermissions.length < installResult.allRequested.length) {
    const confirmProceed = await new Promise((resolve) => {
      context.showModal({
        title: "Внимание: нет части разрешений",
        message: "Вы сняли некоторые галочки. Некоторые функции мини-приложения могут не работать.",
        type: "confirm",
        buttons: [
          { text: "Назад", primary: false, callback: () => resolve(false) },
          { text: "Продолжить", primary: true, callback: () => resolve(true) }
        ]
      });
    });

    if (!confirmProceed) {
      // Повторяем выбор разрешений
      return await installWithPermissions(params, context);
    }
  }

  // Сохраняем манифест с фактически выданными разрешениями в permissions
  const finalManifest = {
    ...appManifest,
    permissions: installResult.grantedPermissions
  };

  localStorage.setItem("installed_app_" + finalManifest.id, JSON.stringify(finalManifest));
  return { installed: true, appId: finalManifest.id, version: finalManifest.version };
}
