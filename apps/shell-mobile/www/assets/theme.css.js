// Генератор https://mapp.local/theme.css — отдаёт CSS активной темы.
//
// MappLocalAssetHandler сначала ищет статический файл public/assets/theme.css,
// не находит его и запускает этот скрипт в Rhino (см. runGenerator/readGenerator).
// В скрипт передаётся ctx: { db: { getSystemKv(namespace, key) }, query: {} },
// вернуть нужно { body, mimeType, cacheable }, где body — строка.
//
// Скрипт исполняется в Rhino 1.7.15, поэтому здесь только ES5: var/function,
// без стрелочных функций, let/const, шаблонных строк, классов, spread,
// Object.assign, Map/Set, а также без optional chaining и ??.
// Тест tests/theme/theme-css-generator.test.mjs проверяет это по исходнику.

var MAX_CSS_LENGTH = 16 * 1024;
var VAR_NAME = /^--[A-Za-z0-9_-]{1,64}$/;
var FORBIDDEN_VALUE = /[{}<>@\\]|(?:url|image|image-set|src|cross-fade)\s*\(/i;
var THEME_ID = /^[a-z0-9_-]{1,32}$/;
var DEFAULT_THEME_ID = "light";
var EMPTY_THEME = ":root {\n}\n";

function readKv(db, namespace, key) {
    try {
        var value = db.getSystemKv(namespace, key);
        return typeof value === "string" ? value : null;
    } catch (e) {
        return null;
    }
}

function trim(value) {
    return value.replace(/^\s+|\s+$/g, "");
}

// Разбирает сохранённый CSS темы (:root { --name: value; ... }) в плоский список
// объявлений. Всё, что не проходит проверку, молча пропускается: генератор
// обязан отдать валидный CSS, а не 500. Сохраняемый CSS уже канонизируется в
// MappThemeCss.canonicalize, здесь — вторая линия обороны для того, что пришло
// в базу другим путём.
function parseDeclarations(css) {
    var declarations = [];
    if (!css) {
        return declarations;
    }
    var text = String(css);
    var truncated = text.length > MAX_CSS_LENGTH;
    if (truncated) {
        text = text.substring(0, MAX_CSS_LENGTH);
    }
    var open = text.indexOf("{");
    if (open < 0) {
        return declarations;
    }
    // Обрезанный CSS не обязан заканчиваться закрывающей скобкой: тогда телом
    // считается весь остаток, а последнее (недописанное) объявление отбрасывается.
    var close = text.lastIndexOf("}");
    var body = close > open ? text.substring(open + 1, close) : text.substring(open + 1);
    var parts = body.split(";");
    if (close <= open && !/;\s*$/.test(body)) {
        parts.pop();
    }
    for (var i = 0; i < parts.length; i++) {
        var declaration = trim(parts[i]);
        if (!declaration) {
            continue;
        }
        var colon = declaration.indexOf(":");
        if (colon <= 0) {
            continue;
        }
        var name = trim(declaration.substring(0, colon));
        var value = trim(declaration.substring(colon + 1).replace(/\s+/g, " "));
        if (!VAR_NAME.test(name) || !value || FORBIDDEN_VALUE.test(value)) {
            continue;
        }
        declarations.push({ name: name, value: value });
    }
    return declarations;
}

function comment(value) {
    return String(value).replace(/\*\//g, "").replace(/[^A-Za-z0-9_-]/g, "");
}

export default function (ctx) {
    var db = ctx && ctx.db ? ctx.db : null;
    var themeId = db ? trim(readKv(db, "config", "active_theme") || "") : "";
    if (!THEME_ID.test(themeId)) {
        themeId = DEFAULT_THEME_ID;
    }
    var css = db ? readKv(db, "themes", themeId) : null;
    var declarations = parseDeclarations(css);

    var body = "/* theme.css: active theme " + comment(themeId) + " */\n";
    body += declarations.length > 0 ? ":root {\n" : EMPTY_THEME;
    for (var i = 0; i < declarations.length; i++) {
        body += "  " + declarations[i].name + ": " + declarations[i].value + ";\n";
    }
    if (declarations.length > 0) {
        body += "}\n";
    }

    return { body: body, mimeType: "text/css", cacheable: false };
}
