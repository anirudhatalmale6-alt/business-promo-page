"""Screenshot + layout QA for the promo page.

Checks, at each width:
  - no horizontal overflow (document scrollWidth must not exceed the viewport)
  - no element sticking out past the right edge
Then saves viewport screenshots (never full_page, never > 2000px).
"""
import sys, pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = (ROOT / "index.html").as_uri()
OUT = ROOT / "qa" / "shots"
OUT.mkdir(parents=True, exist_ok=True)

WIDTHS = [(320, 640), (375, 700), (768, 900), (1024, 720), (1280, 720), (1600, 900)]

OVERFLOW_JS = """(w) => {
  const bad = [];
  document.querySelectorAll('body *').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;
    if (el.closest('.hp')) return;   // honeypot is parked off-screen on purpose
    if (r.right > w + 1.5 || r.left < -1.5) {
      bad.push({tag: el.tagName.toLowerCase(), cls: el.className && el.className.toString().slice(0,60),
                left: Math.round(r.left), right: Math.round(r.right)});
    }
  });
  return {scrollW: document.documentElement.scrollWidth, inner: window.innerWidth, bad: bad.slice(0, 12)};
}"""

fails = []
with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type == "error" else None)

    for w, h in WIDTHS:
        page.set_viewport_size({"width": w, "height": h})
        page.goto(URL)
        page.wait_for_timeout(700)
        res = page.evaluate(OVERFLOW_JS, w)
        status = "OK "
        if res["scrollW"] > res["inner"] + 1 or res["bad"]:
            status = "FAIL"
            fails.append((w, res))
        print(f"{status} {w}px  scrollWidth={res['scrollW']} inner={res['inner']} offenders={len(res['bad'])}")
        for b in res["bad"]:
            print(f"      -> <{b['tag']} class='{b['cls']}'> left={b['left']} right={b['right']}")
        page.screenshot(path=str(OUT / f"top-{w}.png"))

        # second viewport-sized shot further down the page
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(900)
        page.screenshot(path=str(OUT / f"bottom-{w}.png"))

    if errors:
        print("\nJS ERRORS:")
        for e in errors:
            print("  ", e)
        fails.append(("js", errors))

    browser.close()

print("\nRESULT:", "FAIL" if fails else "PASS")
sys.exit(1 if fails else 0)
