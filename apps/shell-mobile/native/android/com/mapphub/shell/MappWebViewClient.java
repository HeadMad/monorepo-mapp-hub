package com.mapphub.shell;

import android.content.Context;
import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import java.util.regex.Pattern;

public class MappWebViewClient extends BridgeWebViewClient {
    private static final String SHARED_HOST = "mapp.local";
    private static final String MINIAPP_PREFIX = "miniapp-";
    private static final String MINIAPP_SUFFIX = ".local";
    private static final String THEME_NAMESPACE = "theme";
    private static final String THEME_TOKENS_KEY = "tokens";
    private static final String THEME_CSS_NAME = "theme-tokens.css";
    private static final Pattern ASSET_NAME = Pattern.compile("[A-Za-z0-9][A-Za-z0-9._-]*");
    private static final Pattern CSS_VAR_NAME = Pattern.compile("--[A-Za-z0-9_-]+");
    private static final Pattern CSS_VALUE_FORBIDDEN = Pattern.compile("[;{}<>]");

    private final Context context;
    private final MappDatabaseHelper db;
    private final MappPackageManager packages;

    public MappWebViewClient(Bridge bridge, Context context, MappDatabaseHelper db, MappPackageManager packages) {
        super(bridge);
        this.context = context;
        this.db = db;
        this.packages = packages;
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        Uri uri = request.getUrl();
        String host = uri.getHost();
        if (SHARED_HOST.equals(host)) return serveShared(uri);
        if (host != null && host.startsWith(MINIAPP_PREFIX) && host.endsWith(MINIAPP_SUFFIX)) {
            return serveMiniApp(host, uri);
        }
        return super.shouldInterceptRequest(view, request);
    }

    private WebResourceResponse serveShared(Uri uri) {
        Map<String, String> headers = corsHeaders();
        String name = fileName(uri);
        if (THEME_CSS_NAME.equals(name)) {
            return textResponse("text/css", buildThemeCss(), headers);
        }
        if (!ASSET_NAME.matcher(name).matches()) return notFound(headers);
        try {
            InputStream in = context.getAssets().open("mapp_shared/" + name);
            String mime = GitHubPagesPathHandler.mimeFor(name);
            return new WebResourceResponse(mime, encodingFor(mime), 200, "OK", headers, in);
        } catch (IOException e) {
            return notFound(headers);
        }
    }

    private WebResourceResponse serveMiniApp(String host, Uri uri) {
        Map<String, String> headers = new HashMap<>();
        String appId = host.substring(MINIAPP_PREFIX.length(), host.length() - MINIAPP_SUFFIX.length());
        Map<String, Object> registry = MappPackageManager.isSafeSegment(appId) ? db.getRegistry(appId) : null;
        if (registry == null || Boolean.TRUE.equals(registry.get("isRemote"))) return notFound(headers);
        try {
            File root = packages.getVersionDir(appId, (String) registry.get("activeVersion"));
            GitHubPagesPathHandler.Resolved resolved = new GitHubPagesPathHandler(root).resolve(uri.getPath());
            if (resolved == null) return notFound(headers);
            String mime = GitHubPagesPathHandler.mimeFor(resolved.file.getName());
            InputStream in = new FileInputStream(resolved.file);
            String reason = resolved.status == 200 ? "OK" : "Not Found";
            return new WebResourceResponse(mime, encodingFor(mime), resolved.status, reason, headers, in);
        } catch (IOException e) {
            return notFound(headers);
        }
    }

    private String buildThemeCss() {
        StringBuilder css = new StringBuilder(":root {\n");
        String raw = db.getSystem(THEME_NAMESPACE, THEME_TOKENS_KEY);
        if (raw != null) {
            try {
                JSONObject tokens = new JSONObject(raw);
                Iterator<String> names = tokens.keys();
                while (names.hasNext()) {
                    String name = names.next();
                    String value = tokens.optString(name, "");
                    if (!CSS_VAR_NAME.matcher(name).matches() || CSS_VALUE_FORBIDDEN.matcher(value).find()) continue;
                    css.append("  ").append(name).append(": ").append(value).append(";\n");
                }
            } catch (JSONException e) {
                return css.append("}\n").toString();
            }
        }
        return css.append("}\n").toString();
    }

    private static String fileName(Uri uri) {
        String path = uri.getPath();
        if (path == null) return "";
        return path.startsWith("/") ? path.substring(1) : path;
    }

    private static Map<String, String> corsHeaders() {
        Map<String, String> headers = new HashMap<>();
        headers.put("Access-Control-Allow-Origin", "*");
        return headers;
    }

    private static WebResourceResponse textResponse(String mime, String body, Map<String, String> headers) {
        InputStream in = new ByteArrayInputStream(body.getBytes(StandardCharsets.UTF_8));
        return new WebResourceResponse(mime, "UTF-8", 200, "OK", headers, in);
    }

    private static WebResourceResponse notFound(Map<String, String> headers) {
        InputStream in = new ByteArrayInputStream("Not found".getBytes(StandardCharsets.UTF_8));
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", headers, in);
    }

    private static String encodingFor(String mime) {
        boolean textual = mime.startsWith("text/")
                || mime.equals("application/javascript")
                || mime.equals("application/json")
                || mime.equals("image/svg+xml");
        return textual ? "UTF-8" : null;
    }
}
