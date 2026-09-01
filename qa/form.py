"""Functional QA for the contact form + navigation.

Covers: empty submit, bad email, short message, unticked consent,
the honeypot, the timing trap, and a valid submission.
"""
import sys, pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = (ROOT / "index.html").as_uri()
OUT = ROOT / "qa" / "shots"
OUT.mkdir(parents=True, exist_ok=True)

results = []
def check(label, ok, detail=""):
    results.append((label, ok, detail))
    print(("PASS " if ok else "FAIL ") + label + ((" -- " + detail) if detail else ""))

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1280, "height": 800})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))

    # ---------- 1. empty submit shows errors, sends nothing ----------
    page.goto(URL)
    page.wait_for_timeout(3200)          # clear the 3s timing trap
    page.click("#submit-btn")
    page.wait_for_timeout(300)
    check("empty submit -> name error",    page.inner_text("#name-error").strip() != "")
    check("empty submit -> email error",   page.inner_text("#email-error").strip() != "")
    check("empty submit -> message error", page.inner_text("#message-error").strip() != "")
    check("empty submit -> consent error", page.inner_text("#consent-error").strip() != "")
    check("empty submit -> error banner",  "form-alert--error" in page.get_attribute("#form-alert", "class"))
    check("empty submit -> focus moved to first bad field",
          page.evaluate("document.activeElement.id") == "name",
          page.evaluate("document.activeElement.id"))
    page.screenshot(path=str(OUT / "form-errors.png"))

    # ---------- 2. malformed email ----------
    page.fill("#name", "Jane Whitfield")
    page.fill("#email", "jane@nope")
    page.click("#message")
    page.wait_for_timeout(200)
    check("bad email flagged", page.inner_text("#email-error").strip() != "",
          page.inner_text("#email-error").strip())

    # ---------- 3. too-short message ----------
    page.fill("#email", "jane@yourcompany.com")
    page.fill("#message", "hi there")
    page.click("#name")
    page.wait_for_timeout(200)
    check("short message flagged", page.inner_text("#message-error").strip() != "")
    check("email error cleared once fixed", page.inner_text("#email-error").strip() == "")

    # ---------- 4. consent still required ----------
    page.fill("#message", "We are a 40-person logistics firm and our margins have slipped two years running.")
    page.click("#submit-btn")
    page.wait_for_timeout(300)
    check("consent still blocks submit", page.inner_text("#consent-error").strip() != "")
    check("no success banner while invalid",
          "form-alert--success" not in (page.get_attribute("#form-alert", "class") or ""))

    # ---------- 5. valid submit -> success ----------
    page.check("#consent")
    page.click("#submit-btn")
    page.wait_for_timeout(1500)
    cls = page.get_attribute("#form-alert", "class") or ""
    check("valid submit -> success banner", "form-alert--success" in cls, cls)
    check("success banner is visible", page.is_visible("#form-alert"))
    check("form cleared after send", page.input_value("#name") == "" and page.input_value("#message") == "")
    check("button re-enabled", page.evaluate("document.getElementById('submit-btn').disabled") is False)
    page.screenshot(path=str(OUT / "form-success.png"))
    print("   banner text:", page.inner_text("#form-alert").replace("\n", " ")[:120])

    # ---------- 6. honeypot: filled hidden field is silently dropped ----------
    page.goto(URL)
    page.wait_for_timeout(3200)
    page.fill("#name", "Spam Bot")
    page.fill("#email", "bot@spam.example")
    page.fill("#message", "Cheap backlinks for your website, buy now, limited offer today only.")
    page.check("#consent")
    page.evaluate("document.getElementById('company-website').value = 'http://spam.example'")
    page.click("#submit-btn")
    page.wait_for_timeout(400)
    check("honeypot -> looks successful to the bot",
          "form-alert--success" in (page.get_attribute("#form-alert", "class") or ""))
    check("honeypot -> resolved instantly, so nothing was sent",
          page.evaluate("document.getElementById('submit-btn').classList.contains('is-sending')") is False)
    check("honeypot input is invisible to humans", page.is_hidden("#company-website") or
          page.evaluate("getComputedStyle(document.querySelector('.hp')).opacity") == "0")

    # ---------- 7. timing trap ----------
    page.goto(URL)
    page.fill("#name", "Fast Bot")
    page.fill("#email", "fast@spam.example")
    page.fill("#message", "Submitted in well under three seconds flat, like a script would.")
    page.check("#consent")
    page.click("#submit-btn")
    page.wait_for_timeout(300)
    check("sub-3-second submit silently dropped",
          page.evaluate("document.getElementById('submit-btn').classList.contains('is-sending')") is False)

    # ---------- 8. mobile navigation ----------
    page.set_viewport_size({"width": 375, "height": 700})
    page.goto(URL)
    page.wait_for_timeout(400)
    check("burger visible on mobile", page.is_visible(".nav-toggle"))
    check("drawer closed initially", page.get_attribute(".nav-toggle", "aria-expanded") == "false")
    page.click(".nav-toggle")
    page.wait_for_timeout(400)
    check("drawer opens", page.get_attribute(".nav-toggle", "aria-expanded") == "true")
    check("nav links reachable", page.is_visible(".nav__link"))
    page.screenshot(path=str(OUT / "nav-open-375.png"))
    page.click("a.nav__link[href='#contact']")
    page.wait_for_timeout(900)
    check("drawer closes after choosing a link",
          page.get_attribute(".nav-toggle", "aria-expanded") == "false")
    check("anchor scrolled to contact", page.evaluate("window.pageYOffset") > 200)

    # ---------- 9. no JS errors anywhere ----------
    check("no JavaScript errors", not errors, "; ".join(errors))
    browser.close()

failed = [r for r in results if not r[1]]
print("\n%d/%d passed" % (len(results) - len(failed), len(results)))
print("RESULT:", "FAIL" if failed else "PASS")
sys.exit(1 if failed else 0)
