package com.mapphub.shell;

import android.content.Context;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

public class MappPackageManager {
    private static final Pattern SAFE_SEGMENT = Pattern.compile("[A-Za-z0-9][A-Za-z0-9._-]{0,127}");
    private static MappPackageManager instance;

    private final File root;
    private final ExecutorService cleaner = Executors.newSingleThreadExecutor();

    private MappPackageManager(Context context) {
        this.root = new File(context.getNoBackupFilesDir(), "miniapps");
    }

    public static synchronized MappPackageManager getInstance(Context context) {
        if (instance == null) instance = new MappPackageManager(context.getApplicationContext());
        return instance;
    }

    public static boolean isSafeSegment(String value) {
        return value != null && SAFE_SEGMENT.matcher(value).matches() && !value.contains("..");
    }

    public File getVersionDir(String appId, String version) {
        return new File(new File(root, appId), version);
    }

    public void installPackage(String appId, String version, File zipFile) throws IOException {
        stage(appId, version, dir -> extract(zipFile, dir));
    }

    private void stage(String appId, String version, Extractor extractor) throws IOException {
        if (!isSafeSegment(appId) || !isSafeSegment(version)) {
            throw new IOException("Invalid appId or version");
        }
        File appDir = new File(root, appId);
        File tempDir = new File(appDir, version + "_temp");
        File targetDir = new File(appDir, version);
        deleteRecursively(tempDir);
        if (!tempDir.mkdirs()) throw new IOException("Cannot create " + tempDir);
        try {
            extractor.extract(tempDir);
            deleteRecursively(targetDir);
            if (!tempDir.renameTo(targetDir)) throw new IOException("Cannot activate version " + version);
        } catch (IOException | RuntimeException e) {
            deleteRecursively(tempDir);
            throw e;
        }
    }

    private interface Extractor {
        void extract(File dir) throws IOException;
    }

    public void pruneVersions(String appId, String activeVersion) {
        cleaner.execute(() -> {
            File[] entries = new File(root, appId).listFiles();
            if (entries == null) return;
            for (File entry : entries) {
                String name = entry.getName();
                if (entry.isDirectory() && !name.equals(activeVersion) && !name.endsWith("_temp")) {
                    deleteRecursively(entry);
                }
            }
        });
    }

    public void uninstall(String appId) {
        deleteRecursively(new File(root, appId));
    }

    private static void extract(File zipFile, File targetDir) throws IOException {
        String targetCanonical = targetDir.getCanonicalPath();
        String targetPrefix = targetCanonical + File.separator;
        try (ZipInputStream zis = new ZipInputStream(new FileInputStream(zipFile))) {
            ZipEntry entry;
            while ((entry = zis.getNextEntry()) != null) {
                File destFile = new File(targetDir, entry.getName());
                String destCanonical = destFile.getCanonicalPath();
                if (destCanonical.equals(targetCanonical)) {
                    zis.closeEntry();
                    continue;
                }
                if (!destCanonical.startsWith(targetPrefix)) {
                    throw new IOException("Zip Slip entry rejected: " + entry.getName());
                }
                if (entry.isDirectory()) {
                    if (!destFile.isDirectory() && !destFile.mkdirs()) {
                        throw new IOException("Cannot create " + destFile);
                    }
                } else {
                    File parent = destFile.getParentFile();
                    if (parent != null && !parent.isDirectory() && !parent.mkdirs()) {
                        throw new IOException("Cannot create " + parent);
                    }
                    try (OutputStream out = new FileOutputStream(destFile)) {
                        byte[] buffer = new byte[8192];
                        int read;
                        while ((read = zis.read(buffer)) > 0) out.write(buffer, 0, read);
                    }
                }
                zis.closeEntry();
            }
        }
    }

    public static void deleteRecursively(File file) {
        if (file.isDirectory()) {
            File[] children = file.listFiles();
            if (children != null) {
                for (File child : children) deleteRecursively(child);
            }
        }
        file.delete();
    }
}
