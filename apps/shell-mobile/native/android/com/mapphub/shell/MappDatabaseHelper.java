package com.mapphub.shell;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class MappDatabaseHelper extends SQLiteOpenHelper {
    private static final String DB_NAME = "mapp_system.db";
    private static final int DB_VERSION = 1;
    private static final String LIGHT_CSS = ":root {\n"
            + "  --mapp-color-bg: #f5f6f8;\n"
            + "  --mapp-color-surface: #ffffff;\n"
            + "  --mapp-color-text: #1c1f24;\n"
            + "  --mapp-color-muted: #6b7280;\n"
            + "  --mapp-color-primary: #2563eb;\n"
            + "  --mapp-color-primary-text: #ffffff;\n"
            + "  --mapp-color-border: #d1d5db;\n"
            + "  --mapp-color-danger: #dc2626;\n"
            + "  --mapp-radius-sm: 6px;\n"
            + "  --mapp-radius-md: 12px;\n"
            + "  --mapp-radius-lg: 20px;\n"
            + "  --mapp-font-family: 'Roboto', system-ui, sans-serif;\n"
            + "  --mapp-font-size-base: 16px;\n"
            + "}\n";
    private static final String DARK_CSS = ":root {\n"
            + "  --mapp-color-bg: #0f1115;\n"
            + "  --mapp-color-surface: #181b22;\n"
            + "  --mapp-color-text: #e5e7eb;\n"
            + "  --mapp-color-muted: #9ca3af;\n"
            + "  --mapp-color-primary: #3b82f6;\n"
            + "  --mapp-color-primary-text: #ffffff;\n"
            + "  --mapp-color-border: #2d3340;\n"
            + "  --mapp-color-danger: #ef4444;\n"
            + "  --mapp-radius-sm: 6px;\n"
            + "  --mapp-radius-md: 12px;\n"
            + "  --mapp-radius-lg: 20px;\n"
            + "  --mapp-font-family: 'Roboto', system-ui, sans-serif;\n"
            + "  --mapp-font-size-base: 16px;\n"
            + "}\n";
    private static MappDatabaseHelper instance;

    private MappDatabaseHelper(Context context) {
        super(context.getApplicationContext(), DB_NAME, null, DB_VERSION);
        setWriteAheadLoggingEnabled(true);
    }

    public static synchronized MappDatabaseHelper getInstance(Context context) {
        if (instance == null) instance = new MappDatabaseHelper(context);
        return instance;
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE miniapp_storage ("
                + "app_id TEXT NOT NULL,"
                + "key TEXT NOT NULL,"
                + "value TEXT NOT NULL,"
                + "size_bytes INTEGER NOT NULL,"
                + "updated_at INTEGER DEFAULT (strftime('%s', 'now')),"
                + "PRIMARY KEY (app_id, key)) WITHOUT ROWID");
        db.execSQL("CREATE TABLE system_registry ("
                + "app_id TEXT PRIMARY KEY,"
                + "name TEXT NOT NULL,"
                + "active_version TEXT NOT NULL,"
                + "entry_point TEXT DEFAULT 'index.html',"
                + "is_remote INTEGER DEFAULT 0,"
                + "remote_url TEXT,"
                + "manifest_json TEXT,"
                + "updated_at INTEGER DEFAULT (strftime('%s', 'now'))) WITHOUT ROWID");
        db.execSQL("CREATE TABLE system_kv ("
                + "namespace TEXT NOT NULL,"
                + "key TEXT NOT NULL,"
                + "value TEXT NOT NULL,"
                + "updated_at INTEGER DEFAULT (strftime('%s', 'now')),"
                + "PRIMARY KEY (namespace, key)) WITHOUT ROWID");
        seedDefaults(db);
    }

    @Override
    public void onOpen(SQLiteDatabase db) {
        super.onOpen(db);
        if (!db.isReadOnly()) seedDefaults(db);
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
    }

    private static void seedDefaults(SQLiteDatabase db) {
        insertIfAbsent(db, "themes", "light", LIGHT_CSS);
        insertIfAbsent(db, "themes", "dark", DARK_CSS);
        insertIfAbsent(db, "config", "active_theme", "light");
    }

    private static void insertIfAbsent(SQLiteDatabase db, String namespace, String key, String value) {
        ContentValues cv = new ContentValues();
        cv.put("namespace", namespace);
        cv.put("key", key);
        cv.put("value", value);
        db.insertWithOnConflict("system_kv", null, cv, SQLiteDatabase.CONFLICT_IGNORE);
    }

    public void putStorageItem(String appId, String key, String value) {
        ContentValues cv = new ContentValues();
        cv.put("app_id", appId);
        cv.put("key", key);
        cv.put("value", value);
        cv.put("size_bytes", value.getBytes(StandardCharsets.UTF_8).length);
        getWritableDatabase().insertWithOnConflict("miniapp_storage", null, cv, SQLiteDatabase.CONFLICT_REPLACE);
    }

    public String getStorageItem(String appId, String key) {
        try (Cursor c = getReadableDatabase().query("miniapp_storage", new String[]{"value"},
                "app_id = ? AND key = ?", new String[]{appId, key}, null, null, null)) {
            return c.moveToFirst() ? c.getString(0) : null;
        }
    }

    public void removeStorageItem(String appId, String key) {
        getWritableDatabase().delete("miniapp_storage", "app_id = ? AND key = ?", new String[]{appId, key});
    }

    public List<String> getStorageKeys(String appId) {
        List<String> keys = new ArrayList<>();
        try (Cursor c = getReadableDatabase().query("miniapp_storage", new String[]{"key"},
                "app_id = ?", new String[]{appId}, null, null, "key")) {
            while (c.moveToNext()) keys.add(c.getString(0));
        }
        return keys;
    }

    public void clearStorage(String appId) {
        getWritableDatabase().delete("miniapp_storage", "app_id = ?", new String[]{appId});
    }

    public void upsertRegistry(String appId, String name, String activeVersion, String entryPoint,
                               boolean isRemote, String remoteUrl, String manifestJson) {
        ContentValues cv = new ContentValues();
        cv.put("app_id", appId);
        cv.put("name", name);
        cv.put("active_version", activeVersion);
        cv.put("entry_point", entryPoint);
        cv.put("is_remote", isRemote ? 1 : 0);
        cv.put("remote_url", remoteUrl);
        cv.put("manifest_json", manifestJson);
        getWritableDatabase().insertWithOnConflict("system_registry", null, cv, SQLiteDatabase.CONFLICT_REPLACE);
    }

    public Map<String, Object> getRegistry(String appId) {
        try (Cursor c = getReadableDatabase().query("system_registry", null,
                "app_id = ?", new String[]{appId}, null, null, null)) {
            return c.moveToFirst() ? registryRow(c) : null;
        }
    }

    public List<Map<String, Object>> listRegistry() {
        List<Map<String, Object>> rows = new ArrayList<>();
        try (Cursor c = getReadableDatabase().query("system_registry", null,
                null, null, null, null, "app_id")) {
            while (c.moveToNext()) rows.add(registryRow(c));
        }
        return rows;
    }

    public void deleteMiniApp(String appId) {
        SQLiteDatabase db = getWritableDatabase();
        db.beginTransaction();
        try {
            db.delete("miniapp_storage", "app_id = ?", new String[]{appId});
            db.delete("system_registry", "app_id = ?", new String[]{appId});
            db.setTransactionSuccessful();
        } finally {
            db.endTransaction();
        }
    }

    public void putSystem(String namespace, String key, String value) {
        ContentValues cv = new ContentValues();
        cv.put("namespace", namespace);
        cv.put("key", key);
        cv.put("value", value);
        getWritableDatabase().insertWithOnConflict("system_kv", null, cv, SQLiteDatabase.CONFLICT_REPLACE);
    }

    public String getSystem(String namespace, String key) {
        try (Cursor c = getReadableDatabase().query("system_kv", new String[]{"value"},
                "namespace = ? AND key = ?", new String[]{namespace, key}, null, null, null)) {
            return c.moveToFirst() ? c.getString(0) : null;
        }
    }

    public static boolean isBuiltinTheme(String themeId) {
        return "light".equals(themeId) || "dark".equals(themeId);
    }

    public static String builtinThemeCss(String themeId) {
        return "light".equals(themeId) ? LIGHT_CSS : DARK_CSS;
    }

    public List<String> listThemeIds() {
        List<String> ids = new ArrayList<>();
        try (Cursor c = getReadableDatabase().query("system_kv", new String[]{"key"},
                "namespace = ?", new String[]{"themes"}, null, null, "key")) {
            while (c.moveToNext()) ids.add(c.getString(0));
        }
        return ids;
    }

    public String getThemeCss(String themeId) {
        return getSystem("themes", themeId);
    }

    public void putThemeCss(String themeId, String css) {
        putSystem("themes", themeId, css);
    }

    public String getActiveThemeId() {
        String id = getSystem("config", "active_theme");
        return id != null ? id : "light";
    }

    public void setActiveThemeId(String themeId) {
        putSystem("config", "active_theme", themeId);
    }

    private static Map<String, Object> registryRow(Cursor c) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("appId", c.getString(c.getColumnIndexOrThrow("app_id")));
        row.put("name", c.getString(c.getColumnIndexOrThrow("name")));
        row.put("activeVersion", c.getString(c.getColumnIndexOrThrow("active_version")));
        row.put("entryPoint", c.getString(c.getColumnIndexOrThrow("entry_point")));
        row.put("isRemote", c.getInt(c.getColumnIndexOrThrow("is_remote")) == 1);
        row.put("remoteUrl", c.getString(c.getColumnIndexOrThrow("remote_url")));
        row.put("manifestJson", c.getString(c.getColumnIndexOrThrow("manifest_json")));
        return row;
    }
}
