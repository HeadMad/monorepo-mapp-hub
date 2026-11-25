package com.mapphub.shell;

import java.util.regex.Pattern;

final class MappThemeCss {
    static final Pattern THEME_ID = Pattern.compile("[a-z0-9_-]{1,32}");
    private static final int MAX_LENGTH = 16 * 1024;
    private static final Pattern VAR_NAME = Pattern.compile("--[A-Za-z0-9_-]{1,64}");
    private static final Pattern FORBIDDEN_VALUE =
            Pattern.compile("[{}<>@\\\\]|(?i)\\b(url|image|image-set|src|cross-fade)\\s*\\(");

    private MappThemeCss() {
    }

    static String canonicalize(String css) {
        if (css == null || css.length() > MAX_LENGTH) {
            throw new IllegalArgumentException("css is missing or too large");
        }
        String trimmed = css.trim();
        int open = trimmed.indexOf('{');
        if (open < 0 || !trimmed.endsWith("}") || !":root".equals(trimmed.substring(0, open).trim())) {
            throw new IllegalArgumentException("css must be a single :root { ... } block");
        }
        String body = trimmed.substring(open + 1, trimmed.length() - 1);
        StringBuilder out = new StringBuilder(":root {\n");
        for (String declaration : body.split(";")) {
            String d = declaration.trim();
            if (d.isEmpty()) {
                continue;
            }
            int colon = d.indexOf(':');
            if (colon <= 0) {
                throw new IllegalArgumentException("invalid declaration: " + d);
            }
            String name = d.substring(0, colon).trim();
            String value = d.substring(colon + 1).trim();
            if (!VAR_NAME.matcher(name).matches()) {
                throw new IllegalArgumentException("invalid variable name: " + name);
            }
            if (value.isEmpty() || FORBIDDEN_VALUE.matcher(value).find()) {
                throw new IllegalArgumentException("invalid value for " + name);
            }
            out.append("  ").append(name).append(": ").append(value).append(";\n");
        }
        return out.append("}\n").toString();
    }
}
