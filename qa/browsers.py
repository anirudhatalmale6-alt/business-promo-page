"""Cross-browser check: Chromium (Chrome + Edge), Firefox, WebKit (Safari).

Same assertions in each engine: no horizontal overflow at 320px and 1280px,
the form validates and confirms, and no JavaScript errors.
"""
import sys, pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = (ROOT / "index.html").as_uri()
OUT = ROOT / "qa" / "shots"
OUT.mkdir(parents=True, exist_ok=True)

fails = []

def run(engine, launcher):
    errors = []
    page = launcher.new_page(viewport={"width": 1280, "height": 800})
    page.on("pageerror", lambda e: errors.append(str(e)))

    for w, h in [(320, 640), (1280, 800)]:
        page.set_viewport_size({"width": w, "height": h})
        page.goto(URL)
        page.wait_for_timeout(700)
        sw = page.evaluate("document.documentElement.scrollWidth")
        iw = page.evaluate("window.innerWidth")
        ok = sw <= iw + 1
        print(f"  {engine:9s} {w}px  no overflow: {'yes' if ok else 'NO (%d>%d)' % (sw, iw)}")
        if not ok:
            fails.append(f"{engine} {w}px overflow {sw}>{iw}")
        page.screenshot(path=str(OUT / f"{engine}-{w}.png"))

    # form: invalid then valid
    page.set_viewport_size({"width": 1280, "height": 900})
    page.goto(URL)
    page.wait_for_timeout(3200)
    page.click("#submit-btn")
    page.wait_for_timeout(300)
    blocked = page.inner_text("#email-error").strip() != ""
    print(f"  {engine:9s} invalid submit blocked: {'yes' if blocked else 'NO'}")
    if not blocked:
        fails.append(engine + " did not block an invalid submit")

    page.fill("#name", "Jane Whitfield")
    page.fill("#email", "jane@yourcompany.com")
    page.fill("#message", "We are a 40-person logistics firm and margins have slipped two years running.")
    page.check("#consent")
    page.click("#submit-btn")
    page.wait_for_timeout(1500)
    cls = page.get_attribute("#form-alert", "class") or ""
    good = "form-alert--success" in cls and page.is_visible("#form-alert")
    print(f"  {engine:9s} valid submit confirms: {'yes' if good else 'NO (%s)' % cls}")
    if not good:
        fails.append(engine + " showed no confirmation")
    page.screenshot(path=str(OUT / f"{engine}-success.png"))

    # hero image actually rendered (not a broken-image box)
    dims = page.evaluate("""() => { const i = document.querySelector('.hero__image');
        return {c: i.complete, w: i.naturalWidth, h: i.naturalHeight}; }""")
    img_ok = dims["c"] and dims["w"] > 0 and dims["h"] > 0
    print(f"  {engine:9s} hero image loaded: {'yes %dx%d' % (dims['w'], dims['h']) if img_ok else 'NO %s' % dims}")
    if not img_ok:
        fails.append(engine + " hero image did not load")

    print(f"  {engine:9s} JS errors: {errors if errors else 'none'}")
    if errors:
        fails.append(engine + " JS error: " + errors[0])
    page.close()

with sync_playwright() as p:
    for name, bt in [("chromium", p.chromium), ("firefox", p.firefox), ("webkit", p.webkit)]:
        print(name.upper())
        browser = bt.launch()
        run(name, browser)
        browser.close()

print("\nRESULT:", "FAIL -> " + "; ".join(fails) if fails else "PASS")
sys.exit(1 if fails else 0)
