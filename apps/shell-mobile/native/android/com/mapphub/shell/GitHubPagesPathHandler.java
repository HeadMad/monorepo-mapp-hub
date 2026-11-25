package com.mapphub.shell;

import android.webkit.MimeTypeMap;

import java.io.File;
import java.io.IOException;
import java.util.Locale;

public class GitHubPagesPathHandler {

    public static final class Resolved {
        public final File file;
        public final int status;

        Resolved(File file, int status) {
            this.file = file;
            this.status = status;
        }
    }

    private final File root;

    public GitHubPagesPathHandler(File root) {
        this.root = root;
    }

    public Resolved resolve(String rawPath) throws IOException {
        String path = normalize(rawPath);
        if (path.isEmpty()) path = "index.html";

        File file = existingFile(path);
        if (file != null) return new Resolved(file, 200);

        if (!lastSegment(path).contains(".")) {
            file = existingFile(path + ".html");
            if (file != null) return new Resolved(file, 200);
        }

        file = existingFile(path + "/index.html");
        if (file != null) return new Resolved(file, 200);

        file = existingFile("404.html");
        return file != null ? new Resolved(file, 404) : null;
    }

    public static String mimeFor(String name) {
        int dot = name.lastIndexOf('.');
        String ext = dot < 0 ? "" : name.substring(dot + 1).toLowerCase(Locale.ROOT);
        switch (ext) {
            case "html":
            case "htm":
                return "text/html";
            case "js":
            case "mjs":
                return "application/javascript";
            case "css":
                return "text/css";
            case "wasm":
                return "application/wasm";
            case "svg":
                return "image/svg+xml";
            case "json":
                return "application/json";
            case "webmanifest":
                return "application/manifest+json";
            default:
                String mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
                return mime != null ? mime : "application/octet-stream";
        }
    }

    public static String encodingFor(String mime) {
        boolean textual = mime.startsWith("text/")
                || mime.equals("application/javascript")
                || mime.equals("application/json")
                || mime.equals("application/manifest+json")
                || mime.equals("image/svg+xml");
        return textual ? "UTF-8" : null;
    }

    private static String normalize(String rawPath) {
        if (rawPath == null) return "";
        return rawPath.replaceAll("^/+", "").replaceAll("/+$", "");
    }

    private static String lastSegment(String path) {
        return path.substring(path.lastIndexOf('/') + 1);
    }

    private File existingFile(String relativePath) throws IOException {
        File candidate = new File(root, relativePath);
        if (!candidate.isFile()) return null;
        String rootPrefix = root.getCanonicalPath() + File.separator;
        return candidate.getCanonicalPath().startsWith(rootPrefix) ? candidate : null;
    }
}
