import json, re, subprocess, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
def _java_css(name):
    text = (REPO / "apps/shell-mobile/native/android/com/mapphub/shell/MappDatabaseHelper.java").read_text(encoding="utf-8")
    start = text.index(name + " = ")
    block = text[start:text.index(";\n", start)]
    parts = re.findall(r'"((?:[^"\\]|\\.)*)"', block)
    return "".join(parts).replace("\\n", "\n").replace('\\"', '"')

LIGHT = _java_css("LIGHT_CSS")
DARK = _java_css("DARK_CSS")

state = {"active": "light", "themes": {"light": LIGHT, "dark": DARK}}
log = []

def render_theme_css():
    out = subprocess.run(["node", str(HERE / "gen.mjs"), json.dumps(state)], capture_output=True, text=True, check=True)
    return out.stdout

def native_call(method, params):
    log.append(method)
    if method == "theme.getList":
        return {"themes": [{"id": k, "builtin": k in ("light", "dark")} for k in state["themes"]],
                "activeThemeId": state["active"]}
    if method == "theme.getCss":
        return {"css": state["themes"][params["themeId"]]}
    if method == "theme.save":
        state["themes"][params["themeId"]] = params["css"]
        return {"themeId": params["themeId"]}
    if method == "theme.apply":
        if params["themeId"] not in state["themes"]:
            raise ValueError("unknown theme")
        state["active"] = params["themeId"]
        return {"activeThemeId": state["active"]}
    if method == "ui.getThemeTokens":
        css = state["themes"][state["active"]]
        return {"tokens": dict(re.findall(r"(--[\w-]+)\s*:\s*([^;]+);", css))}
    return {}

def route_mapp(route, request):
    url = request.url
    path = url.split("https://mapp.local", 1)[1].split("?", 1)[0]
    if path == "/MappHub.js":
        return route.fulfill(path=str(REPO / "miniapps/_sdk/MappHub.js"), content_type="application/javascript")
    if path == "/theme.css":
        return route.fulfill(body=render_theme_css(), content_type="text/css")
    target = REPO / "miniapps" / path.lstrip("/")
    if target.is_file() and target.resolve().is_relative_to(REPO / "miniapps"):
        ctype = {".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json"}.get(target.suffix, "application/octet-stream")
        return route.fulfill(path=str(target), content_type=ctype)
    return route.fulfill(status=404, body="not found")

def route_shell(route, request):
    path = request.url.split("https://shell.test", 1)[1].split("?", 1)[0]
    if path == "/":
        return route.fulfill(path=str(HERE / "host.html"), content_type="text/html")
    if path == "/tokens.css":
        return route.fulfill(path=str(REPO / "apps/shell-mobile/www/css/tokens.css"), content_type="text/css")
    if path == "/js/bridge/themeCss.js":
        return route.fulfill(path=str(REPO / "apps/shell-mobile/www/js/bridge/themeCss.js"), content_type="application/javascript")
    return route.fulfill(status=404, body="nf")

def bg(frame):
    return frame.evaluate("() => getComputedStyle(document.body).backgroundColor")

def frame_of(page, name):
    for f in page.frames:
        if name in f.url:
            return f
    raise RuntimeError(f"frame {name} not found")

def wait_bg(page, name, expected, timeout=8):
    deadline = time.time() + timeout
    last = None
    while time.time() < deadline:
        last = bg(frame_of(page, name))
        if last == expected:
            return True
        time.sleep(0.2)
    print(f"  !! {name}: expected {expected}, got {last}")
    return False

results = []
def check(label, ok):
    results.append((label, ok))
    print(("PASS " if ok else "FAIL ") + label)

with sync_playwright() as p:
    browser = p.chromium.launch(args=["--no-sandbox"])
    ctx = browser.new_context(ignore_https_errors=True)
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type == "error" else None)
    page.route("https://mapp.local/**", route_mapp)
    page.route("https://shell.test/**", route_shell)
    page.expose_function("nativeCall", native_call)
    page.goto("https://shell.test/")
    page.wait_for_function("window.hostReady === true", timeout=10000)
    # Ждём, пока редактор и лаунчер смонтируются и получат тему.
    time.sleep(2)

    LIGHT_BG = "rgb(245, 246, 248)"
    DARK_BG = "rgb(15, 17, 21)"

    check("старт: оболочка светлая (light)", bg(page.main_frame) == LIGHT_BG)
    check("старт: лаунчер светлый", wait_bg(page, "launcher", LIGHT_BG))
    check("старт: редактор светлый", wait_bg(page, "theme-editor", LIGHT_BG))

    editor = frame_of(page, "theme-editor")
    editor.select_option("#theme-select", "dark")
    time.sleep(0.8)
    editor.click("#btn-apply")
    check("apply dark: редактор стал тёмным", wait_bg(page, "theme-editor", DARK_BG))
    check("apply dark: лаунчер стал тёмным", wait_bg(page, "launcher", DARK_BG))
    time.sleep(1)
    check("apply dark: оболочка стала тёмной", bg(page.main_frame) == DARK_BG)

    # Живое редактирование без apply: меняем фон в строке --mapp-color-bg.
    editor.evaluate("""() => {
        const row = document.querySelector('[data-name="--mapp-color-bg"]');
        const hex = row.querySelector('input.hex');
        hex.value = '#ff0000';
        hex.dispatchEvent(new Event('input', { bubbles: true }));
    }""")
    time.sleep(0.3)
    check("живая правка: страница редактора сразу красная", bg(editor) == "rgb(255, 0, 0)")

    editor.evaluate("""() => {
        const row = document.querySelector('[data-name="--mapp-color-bg"]');
        const hex = row.querySelector('input.hex');
        hex.value = '#f5f6f8';
        hex.dispatchEvent(new Event('input', { bubbles: true }));
    }""")
    time.sleep(0.3)
    check("живая правка назад: страница редактора светлая", bg(editor) == LIGHT_BG)

    print("native calls:", sorted(set(log)))
    print("page errors:", errors[:8] if errors else "none")
    browser.close()

failed = [r for r in results if not r[1]]
print(f"\n{len(results) - len(failed)}/{len(results)} passed")
sys.exit(1 if failed else 0)
