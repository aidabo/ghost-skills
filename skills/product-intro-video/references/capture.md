# Capturing screens with Playwright

Use the target project's own Playwright (resolve it from that project with `createRequire`) so no new dependency is added. Run against a local dev server with test data that is safe to show.

```js
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(`${process.env.APP_DIR}/package.json`);
const { chromium, devices } = require("playwright");

const BASE = process.env.APP_URL ?? "http://localhost:3000";
const OUT = process.argv[2];
// Credentials come from a file or env outside the repo. Never log them.
const [user, pass] = fs.readFileSync(process.env.TEST_ACCOUNT_FILE, "utf8").trim().split(/\r?\n/)[0].split("/");

const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN });
const context = await browser.newContext({ ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, locale: "ja-JP" });
await context.addInitScript(() => { try { localStorage.setItem("preferred-locale", "ja"); } catch {} });
// Log in through the API so the session cookie is shared by every page (Ghost admin session shown).
await context.request.post(`${BASE}/ghost/api/admin/session/`, { data: { username: user, password: pass }, headers: { Origin: BASE } });
const page = await context.newPage();
page.on("filechooser", () => {}); // buttons that open a file picker: open, choose nothing

let n = 0;
const shot = (label) => page.screenshot({ path: `${OUT}/${String(++n).padStart(2, "0")}-${label}.png` });
const go = async (url) => { await page.goto(`${BASE}${url}`, { waitUntil: "networkidle", timeout: 180000 }).catch(() => {}); await page.waitForTimeout(3000); };
const click = async (loc) => { if (!(await loc.count())) return false; await loc.first().scrollIntoViewIfNeeded(); await loc.first().click({ timeout: 8000 }); await page.waitForTimeout(1500); return true; };

// Whole page as viewport-sized slices (for choosing what to show)
const slices = async (label, max = 10) => {
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0, i = 0; y < h && i < max; y += 760, i++) {
    await page.evaluate((v) => window.scrollTo(0, v), y); await page.waitForTimeout(400); await shot(`${label}-${i + 1}`);
  }
};

await go("/dashboard?tab=home"); await slices("home");
// Press, then shoot (never press Save / Send / Publish)
await go("/dashboard?tab=home");
if (await click(page.getByRole("button", { name: /ひとこと送る/ }))) await shot("open-word");
// Scroll one element to the top before shooting
await page.locator(".series-bundle").first().evaluate((e) => window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 100));
await browser.close();
```

Tips:

- For the video's phone frame use `fullPage: true` on the chosen screens so the template can pan through them; use viewport slices to browse first.
- Shoot each language version with the UI in that language (`locale`, the app's stored language key, `Accept-Language`).
- Look at every capture before using it: personal data of real users, half-loaded spinners, open dropdowns and debug banners all show up in the video.
- Name finished captures `s01.png`... in scene order and copy them into the render's public directory.
