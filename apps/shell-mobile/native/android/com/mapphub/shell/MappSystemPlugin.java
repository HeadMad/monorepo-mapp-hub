package com.mapphub.shell;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "MappSystem")
public class MappSystemPlugin extends Plugin {

    private interface Task {
        JSObject run() throws Exception;
    }

    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private MappDatabaseHelper db;
    private MappPackageManager packages;
    private MappLocalAssetHandler assets;

    @Override
    public void load() {
        db = MappDatabaseHelper.getInstance(getContext());
        packages = MappPackageManager.getInstance(getContext());
        assets = MappLocalAssetHandler.getInstance(getContext());
    }

    @PluginMethod
    public void storageSetItem(PluginCall call) {
        run(call, () -> {
            db.putStorageItem(requireAppId(call), requireString(call, "key"), requireString(call, "value"));
            return new JSObject();
        });
    }

    @PluginMethod
    public void storageGetItem(PluginCall call) {
        run(call, () -> {
            JSObject result = new JSObject();
            result.put("value", db.getStorageItem(requireAppId(call), requireString(call, "key")));
            return result;
        });
    }

    @PluginMethod
    public void storageRemoveItem(PluginCall call) {
        run(call, () -> {
            db.removeStorageItem(requireAppId(call), requireString(call, "key"));
            return new JSObject();
        });
    }

    @PluginMethod
    public void storageGetKeys(PluginCall call) {
        run(call, () -> {
            JSObject result = new JSObject();
            result.put("keys", new JSONArray(db.getStorageKeys(requireAppId(call))));
            return result;
        });
    }

    @PluginMethod
    public void storageClear(PluginCall call) {
        run(call, () -> {
            db.clearStorage(requireAppId(call));
            return new JSObject();
        });
    }

    @PluginMethod
    public void systemGet(PluginCall call) {
        run(call, () -> {
            JSObject result = new JSObject();
            result.put("value", db.getSystem(requireString(call, "namespace"), requireString(call, "key")));
            return result;
        });
    }

    @PluginMethod
    public void systemSet(PluginCall call) {
        run(call, () -> {
            db.putSystem(requireString(call, "namespace"), requireString(call, "key"), requireString(call, "value"));
            return new JSObject();
        });
    }

    @PluginMethod
    public void installMiniApp(PluginCall call) {
        run(call, () -> {
            String appId = requireAppId(call);
            String version = requireString(call, "version");
            File zip = new File(requireString(call, "zipPath")).getCanonicalFile();
            if (!isInsideAppStorage(zip)) throw new IllegalArgumentException("zipPath must be inside app storage");
            packages.installPackage(appId, version, zip);
            db.upsertRegistry(appId, requireString(call, "name"), version,
                    call.getString("entryPoint", "index.html"), false, null, call.getString("manifestJson"));
            packages.pruneVersions(appId, version);
            JSObject result = new JSObject();
            result.put("activeVersion", version);
            return result;
        });
    }

    @PluginMethod
    public void uninstallMiniApp(PluginCall call) {
        run(call, () -> {
            String appId = requireAppId(call);
            db.deleteMiniApp(appId);
            packages.uninstall(appId);
            return new JSObject();
        });
    }

    @PluginMethod
    public void getInstalledApps(PluginCall call) {
        run(call, () -> {
            JSONArray apps = new JSONArray();
            for (Map<String, Object> row : db.listRegistry()) apps.put(new JSONObject(row));
            JSObject result = new JSObject();
            result.put("apps", apps);
            return result;
        });
    }

    @PluginMethod
    public void themeGetList(PluginCall call) {
        run(call, () -> {
            JSONArray themes = new JSONArray();
            for (String id : db.listThemeIds()) {
                JSONObject theme = new JSONObject();
                theme.put("id", id);
                theme.put("builtin", MappDatabaseHelper.isBuiltinTheme(id));
                themes.put(theme);
            }
            JSObject result = new JSObject();
            result.put("themes", themes);
            result.put("activeThemeId", db.getActiveThemeId());
            return result;
        });
    }

    @PluginMethod
    public void themeGetCss(PluginCall call) {
        run(call, () -> {
            String css = db.getThemeCss(requireThemeId(call));
            if (css == null) throw new IllegalArgumentException("unknown theme");
            JSObject result = new JSObject();
            result.put("css", css);
            return result;
        });
    }

    @PluginMethod
    public void themeSave(PluginCall call) {
        run(call, () -> {
            String themeId = requireThemeId(call);
            if (MappDatabaseHelper.isBuiltinTheme(themeId)) throw new IllegalArgumentException("protected theme");
            db.putThemeCss(themeId, MappThemeCss.canonicalize(requireString(call, "css")));
            if (themeId.equals(db.getActiveThemeId())) onActiveThemeChanged(themeId);
            JSObject result = new JSObject();
            result.put("themeId", themeId);
            return result;
        });
    }

    @PluginMethod
    public void themeReset(PluginCall call) {
        run(call, () -> {
            String themeId = requireThemeId(call);
            if (!MappDatabaseHelper.isBuiltinTheme(themeId)) throw new IllegalArgumentException("only builtin themes can be reset");
            String css = MappDatabaseHelper.builtinThemeCss(themeId);
            db.putThemeCss(themeId, css);
            if (themeId.equals(db.getActiveThemeId())) onActiveThemeChanged(themeId);
            JSObject result = new JSObject();
            result.put("css", css);
            return result;
        });
    }

    @PluginMethod
    public void themeApply(PluginCall call) {
        run(call, () -> {
            String themeId = requireThemeId(call);
            if (db.getThemeCss(themeId) == null) throw new IllegalArgumentException("unknown theme");
            db.setActiveThemeId(themeId);
            onActiveThemeChanged(themeId);
            JSObject result = new JSObject();
            result.put("activeThemeId", themeId);
            return result;
        });
    }

    @PluginMethod
    public void invalidateAssetCache(PluginCall call) {
        run(call, () -> {
            String filename = call.getString("filename");
            if (filename == null) assets.invalidateAllCache();
            else assets.invalidateCache(filename);
            return new JSObject();
        });
    }

    private void onActiveThemeChanged(String themeId) {
        assets.invalidateCache("theme.css");
        JSObject payload = new JSObject();
        payload.put("themeId", themeId);
        payload.put("timestamp", System.currentTimeMillis());
        getActivity().runOnUiThread(() -> notifyListeners("themeChanged", payload));
    }

    private static String requireThemeId(PluginCall call) {
        String themeId = requireString(call, "themeId");
        if (!MappThemeCss.THEME_ID.matcher(themeId).matches()) throw new IllegalArgumentException("invalid themeId");
        return themeId;
    }

    private void run(PluginCall call, Task task) {
        io.execute(() -> {
            try {
                call.resolve(task.run());
            } catch (Exception e) {
                call.reject(e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName(), e);
            }
        });
    }

    private static String requireString(PluginCall call, String name) {
        String value = call.getString(name);
        if (value == null) throw new IllegalArgumentException(name + " is required");
        return value;
    }

    private static String requireAppId(PluginCall call) {
        String appId = requireString(call, "appId");
        if (!MappPackageManager.isSafeSegment(appId)) throw new IllegalArgumentException("invalid appId");
        return appId;
    }

    private boolean isInsideAppStorage(File file) throws java.io.IOException {
        String path = file.getCanonicalPath();
        return path.startsWith(getContext().getCacheDir().getCanonicalPath() + File.separator)
                || path.startsWith(getContext().getFilesDir().getCanonicalPath() + File.separator);
    }
}
