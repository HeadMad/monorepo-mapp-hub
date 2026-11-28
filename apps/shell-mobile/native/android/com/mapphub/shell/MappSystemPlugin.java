package com.mapphub.shell;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "MappSystem")
public class MappSystemPlugin extends Plugin {

    private interface Task {
        JSObject run() throws Exception;
    }

    private static final String ENTRY_POINT = "index.html";

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
    public void installMiniAppArchive(PluginCall call) {
        run(call, () -> {
            String appId = requireAppId(call);
            String version = requireString(call, "version");
            String archiveUrl = call.getString("archiveUrl");
            String archiveAsset = call.getString("archiveAsset");
            if ((archiveUrl == null) == (archiveAsset == null)) {
                throw new IllegalArgumentException("exactly one of archiveUrl or archiveAsset is required");
            }
            String sha256 = call.getString("sha256");
            if (!MappPackageManager.isSafeSegment(version)) throw new IllegalArgumentException("invalid version");
            File zip = new File(getContext().getCacheDir(), appId + "-" + version + ".zip");
            try {
                if (archiveAsset != null) {
                    copyAsset(archiveAsset, zip);
                } else {
                    downloadArchive(appId, archiveUrl, zip);
                }
                if (sha256 != null && !sha256.equalsIgnoreCase(sha256Of(zip))) {
                    throw new IOException("archive checksum mismatch");
                }
                packages.installPackage(appId, version, zip);
            } finally {
                zip.delete();
            }
            db.upsertRegistry(appId, requireString(call, "name"), version, ENTRY_POINT, false, null,
                    call.getString("manifestJson"));
            packages.pruneVersions(appId, version);
            JSObject result = new JSObject();
            result.put("activeVersion", version);
            return result;
        });
    }

    private void copyAsset(String path, File target) throws IOException {
        if (path.contains("..") || path.startsWith("/")) throw new IOException("invalid asset path");
        try (InputStream in = getContext().getAssets().open("public/" + path);
             OutputStream out = new FileOutputStream(target)) {
            byte[] buffer = new byte[16384];
            int read;
            while ((read = in.read(buffer)) != -1) out.write(buffer, 0, read);
        }
    }

    private void downloadArchive(String appId, String archiveUrl, File target) throws IOException {
        HttpURLConnection conn = (HttpURLConnection) new URL(archiveUrl).openConnection();
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(30000);
        try {
            int code = conn.getResponseCode();
            if (code != HttpURLConnection.HTTP_OK) throw new IOException("HTTP " + code);
            long total = conn.getContentLengthLong();
            long received = 0;
            int lastPercent = -1;
            try (InputStream in = conn.getInputStream(); OutputStream out = new FileOutputStream(target)) {
                byte[] buffer = new byte[16384];
                int read;
                while ((read = in.read(buffer)) != -1) {
                    out.write(buffer, 0, read);
                    received += read;
                    if (total > 0) {
                        int percent = (int) (received * 100 / total);
                        if (percent != lastPercent) {
                            lastPercent = percent;
                            JSObject event = new JSObject();
                            event.put("appId", appId);
                            event.put("percent", percent);
                            notifyListeners("miniAppInstallProgress", event);
                        }
                    }
                }
            }
        } finally {
            conn.disconnect();
        }
    }

    private static String sha256Of(File file) throws IOException {
        try (InputStream in = new FileInputStream(file)) {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] buffer = new byte[16384];
            int read;
            while ((read = in.read(buffer)) != -1) digest.update(buffer, 0, read);
            StringBuilder hex = new StringBuilder();
            for (byte b : digest.digest()) hex.append(String.format("%02x", b));
            return hex.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IOException(e);
        }
    }

    @PluginMethod
    public void fetchMiniAppCatalog(PluginCall call) {
        run(call, () -> {
            String url = requireString(call, "url");
            if (!url.startsWith("https://github.com/")) throw new IllegalArgumentException("catalog url must be on github.com");
            HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(30000);
            try {
                int code = conn.getResponseCode();
                if (code != HttpURLConnection.HTTP_OK) throw new IOException("HTTP " + code);
                ByteArrayOutputStream body = new ByteArrayOutputStream();
                try (InputStream in = conn.getInputStream()) {
                    byte[] buffer = new byte[8192];
                    int read;
                    while ((read = in.read(buffer)) != -1) body.write(buffer, 0, read);
                }
                JSObject result = new JSObject();
                result.put("body", body.toString("UTF-8"));
                return result;
            } finally {
                conn.disconnect();
            }
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
        assets.invalidateCache(MappLocalAssetHandler.THEME_CSS);
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
