package com.mapphub.shell;

import android.content.res.AssetManager;
import android.net.Uri;
import android.util.Log;
import android.webkit.WebResourceResponse;

import org.mozilla.javascript.Context;
import org.mozilla.javascript.ContextAction;
import org.mozilla.javascript.ContextFactory;
import org.mozilla.javascript.Function;
import org.mozilla.javascript.Scriptable;
import org.mozilla.javascript.ScriptableObject;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

public final class MappLocalAssetHandler {
    public static final String HOST = "mapp.local";

    private static final String ASSET_ROOT = "public/assets/";
    private static final String TAG = "MappLocalAsset";
    private static final Pattern FILE_NAME = Pattern.compile("[A-Za-z0-9][A-Za-z0-9._-]{0,127}");
    private static final long GENERATOR_TIME_LIMIT_NS = 2_000_000_000L;
    private static final Object DEADLINE_KEY = new Object();
    private static final ContextFactory RHINO = new ContextFactory() {
        @Override
        protected Context makeContext() {
            Context cx = super.makeContext();
            cx.setOptimizationLevel(-1);
            cx.setInstructionObserverThreshold(10_000);
            return cx;
        }

        @Override
        protected void observeInstructionCount(Context cx, int instructionCount) {
            Object deadline = cx.getThreadLocal(DEADLINE_KEY);
            if (deadline instanceof Long && System.nanoTime() > (Long) deadline) {
                throw new IllegalStateException("generator time limit exceeded");
            }
        }
    };

    private static MappLocalAssetHandler instance;

    private final AssetManager assets;
    private final MappDatabaseHelper db;
    private final Map<String, GeneratedAsset> cache = new ConcurrentHashMap<>();

    private MappLocalAssetHandler(AssetManager assets, MappDatabaseHelper db) {
        this.assets = assets;
        this.db = db;
    }

    public static synchronized MappLocalAssetHandler getInstance(android.content.Context context) {
        if (instance == null) {
            instance = new MappLocalAssetHandler(
                    context.getApplicationContext().getAssets(),
                    MappDatabaseHelper.getInstance(context));
        }
        return instance;
    }

    public WebResourceResponse serve(Uri uri) {
        String name = fileName(uri);
        if (!FILE_NAME.matcher(name).matches()) {
            return notFound();
        }
        GeneratedAsset cached = cache.get(name);
        if (cached != null) {
            return cached.toResponse();
        }
        try {
            return staticResponse(name, assets.open(ASSET_ROOT + name));
        } catch (IOException notStatic) {
            return runGenerator(name, uri);
        }
    }

    public void invalidateCache(String filename) {
        cache.remove(filename);
    }

    public void invalidateAllCache() {
        cache.clear();
    }

    private WebResourceResponse runGenerator(String name, Uri uri) {
        String source = readGenerator(name);
        if (source == null) {
            return notFound();
        }
        try {
            ContextAction<GeneratedAsset> action = cx -> generate(cx, name, source, uri);
            GeneratedAsset asset = (GeneratedAsset) RHINO.call(action);
            if (asset.cacheable) {
                cache.put(name, asset);
            }
            return asset.toResponse();
        } catch (RuntimeException e) {
            Log.w(TAG, "generator failed: " + name, e);
            return errorResponse();
        }
    }

    private GeneratedAsset generate(Context cx, String name, String source, Uri uri) {
        cx.putThreadLocal(DEADLINE_KEY, System.nanoTime() + GENERATOR_TIME_LIMIT_NS);
        Scriptable scope = cx.initStandardObjects();
        String rewritten = source.replaceFirst("(?m)^\\s*export\\s+default\\s+", "var __mapp_gen = ");
        cx.evaluateString(scope, rewritten, name, 1, null);

        Object fn = ScriptableObject.getProperty(scope, "__mapp_gen");
        if (!(fn instanceof Function)) {
            throw new IllegalStateException("generator must export default function");
        }

        Scriptable ctx = cx.newObject(scope);
        ScriptableObject.putProperty(ctx, "db", Context.javaToJS(new DbBridge(db), scope));
        Scriptable query = cx.newObject(scope);
        for (String key : uri.getQueryParameterNames()) {
            ScriptableObject.putProperty(query, key, uri.getQueryParameter(key));
        }
        ScriptableObject.putProperty(ctx, "query", query);

        Object result = ((Function) fn).call(cx, scope, scope, new Object[]{ctx});
        if (!(result instanceof Scriptable)) {
            throw new IllegalStateException("generator must return an object");
        }
        Scriptable out = (Scriptable) result;
        Object body = ScriptableObject.getProperty(out, "body");
        if (!(body instanceof String)) {
            throw new IllegalStateException("generator body must be a string");
        }
        Object mime = ScriptableObject.getProperty(out, "mimeType");
        Object cacheable = ScriptableObject.getProperty(out, "cacheable");
        String mimeType = mime instanceof String ? (String) mime : GitHubPagesPathHandler.mimeFor(name);
        return new GeneratedAsset(((String) body).getBytes(StandardCharsets.UTF_8), mimeType,
                cacheable instanceof Boolean && (Boolean) cacheable);
    }

    private String readGenerator(String name) {
        try (InputStream in = assets.open(ASSET_ROOT + name + ".js")) {
            return new String(readAll(in), StandardCharsets.UTF_8);
        } catch (IOException e) {
            return null;
        }
    }

    private static byte[] readAll(InputStream in) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int read;
        while ((read = in.read(buffer)) != -1) {
            out.write(buffer, 0, read);
        }
        return out.toByteArray();
    }

    private static String fileName(Uri uri) {
        String path = uri.getPath();
        if (path == null) {
            return "";
        }
        return path.startsWith("/") ? path.substring(1) : path;
    }

    private static WebResourceResponse staticResponse(String name, InputStream in) {
        String mime = GitHubPagesPathHandler.mimeFor(name);
        return new WebResourceResponse(mime, GitHubPagesPathHandler.encodingFor(mime), 200, "OK", corsHeaders(), in);
    }

    private static WebResourceResponse notFound() {
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", corsHeaders(),
                new ByteArrayInputStream("Not found".getBytes(StandardCharsets.UTF_8)));
    }

    private static WebResourceResponse errorResponse() {
        return new WebResourceResponse("text/plain", "UTF-8", 500, "Internal Server Error", noStoreHeaders(),
                new ByteArrayInputStream("Generator failed".getBytes(StandardCharsets.UTF_8)));
    }

    private static Map<String, String> corsHeaders() {
        Map<String, String> headers = new HashMap<>();
        headers.put("Access-Control-Allow-Origin", "*");
        return headers;
    }

    private static Map<String, String> noStoreHeaders() {
        Map<String, String> headers = corsHeaders();
        headers.put("Cache-Control", "no-store, no-cache, must-revalidate");
        return headers;
    }

    public static final class DbBridge {
        private final MappDatabaseHelper db;

        DbBridge(MappDatabaseHelper db) {
            this.db = db;
        }

        public String getSystemKv(String namespace, String key) {
            return db.getSystem(namespace, key);
        }
    }

    private static final class GeneratedAsset {
        final byte[] bytes;
        final String mimeType;
        final boolean cacheable;

        GeneratedAsset(byte[] bytes, String mimeType, boolean cacheable) {
            this.bytes = bytes;
            this.mimeType = mimeType;
            this.cacheable = cacheable;
        }

        WebResourceResponse toResponse() {
            return new WebResourceResponse(mimeType, "UTF-8", 200, "OK", noStoreHeaders(),
                    new ByteArrayInputStream(bytes));
        }
    }
}
