package com.mapphub.shell;

import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

public class MappWebViewClient extends BridgeWebViewClient {
    private static final String MINIAPP_PREFIX = "miniapp-";
    private static final String MINIAPP_SUFFIX = ".local";

    private final MappDatabaseHelper db;
    private final MappPackageManager packages;
    private final MappLocalAssetHandler assets;

    public MappWebViewClient(Bridge bridge, MappDatabaseHelper db, MappPackageManager packages,
                             MappLocalAssetHandler assets) {
        super(bridge);
        this.db = db;
        this.packages = packages;
        this.assets = assets;
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        Uri uri = request.getUrl();
        String host = uri.getHost();
        if (MappLocalAssetHandler.HOST.equals(host)) return assets.serve(uri);
        if (host != null && host.startsWith(MINIAPP_PREFIX) && host.endsWith(MINIAPP_SUFFIX)) {
            return serveMiniApp(host, uri);
        }
        return super.shouldInterceptRequest(view, request);
    }

    private WebResourceResponse serveMiniApp(String host, Uri uri) {
        String appId = host.substring(MINIAPP_PREFIX.length(), host.length() - MINIAPP_SUFFIX.length());
        Map<String, Object> registry = MappPackageManager.isSafeSegment(appId) ? db.getRegistry(appId) : null;
        if (registry == null || Boolean.TRUE.equals(registry.get("isRemote"))) return notFound();
        try {
            File root = packages.getVersionDir(appId, (String) registry.get("activeVersion"));
            GitHubPagesPathHandler.Resolved resolved = new GitHubPagesPathHandler(root).resolve(uri.getPath());
            if (resolved == null) return notFound();
            String mime = GitHubPagesPathHandler.mimeFor(resolved.file.getName());
            InputStream in = new FileInputStream(resolved.file);
            String reason = resolved.status == 200 ? "OK" : "Not Found";
            return new WebResourceResponse(mime, GitHubPagesPathHandler.encodingFor(mime), resolved.status, reason,
                    new HashMap<>(), in);
        } catch (IOException e) {
            return notFound();
        }
    }

    private static WebResourceResponse notFound() {
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", new HashMap<>(),
                new ByteArrayInputStream("Not found".getBytes(StandardCharsets.UTF_8)));
    }
}
