// The published lab sites in every browser and device of targets.js: pages
// load without script errors, nothing is wider than the screen, and on
// phones the menu button opens the menu. Read-only; needs the network.
//
//   npm run test:sites
//   npm run test:sites -- --only=iphone --site=https://example.github.io/lab/
import fs from "node:fs";
import path from "node:path";
import { pickTargets, overflow, report, stepper, until } from "./targets.js";

const SITES = process.argv.filter((a) => a.startsWith("--site=")).map((a) => a.slice(7));
const BASES = SITES.length ? SITES : ["https://bobyu89.github.io/sung-lab-website/", "https://bobyu89.github.io/ycho-lab-website/"];
const PAGES = ["", "members.html", "en/"];
const shots = process.argv.find((a) => a.startsWith("--shots="))?.slice(8);

const rows = [];
for (const t of pickTargets(process.argv)) {
  const browser = await t.type.launch();
  for (const base of BASES) {
    const record = { target: `${t.name}｜${base.replace(/^https?:\/\//, "")}`, ok: true, steps: [] };
    const step = stepper(record);
    const context = await browser.newContext(t.context);
    const page = await context.newPage();
    for (const p of PAGES) {
      const errors = [];
      const onError = (e) => errors.push(e.message.split("\n")[0]);
      page.on("pageerror", onError);
      await step(p || "首頁", async () => {
        const res = await page.goto(base + p, { waitUntil: "load", timeout: 45000 });
        if (!res || res.status() >= 400) throw new Error("HTTP " + res?.status());
        await page.waitForTimeout(1200); // the site's own scripts (header, news) settle
        const wide = await overflow(page);
        if (wide) throw new Error(wide);
        if (errors.length) throw new Error("腳本錯誤：" + errors.slice(0, 2).join("；"));
        const button = page.locator("#hamburger-btn");
        if (await button.isVisible()) {
          await (t.touch ? button.tap() : button.click());
          await until(async () => (await button.getAttribute("aria-expanded")) === "true", { timeout: 4000, message: "選單按鈕沒有反應" });
          const nav = page.locator("#site-nav");
          // Slid into the screen (headless WebKit starts the slide late).
          await until(() => nav.evaluate((el) => el.getBoundingClientRect().left < innerWidth - 40), { timeout: 5000, message: "選單沒有滑進畫面" });
          const links = await nav.locator("a:visible").count();
          if (!links) throw new Error("選單裡沒有可點的連結");
          if (shots && p === "") {
            fs.mkdirSync(shots, { recursive: true });
            await page.screenshot({ path: path.join(shots, `site-${t.id}-${base.split("/").filter(Boolean).pop()}-menu.png`) });
          }
          return `選單按鈕可開啟（${links} 個連結）`;
        }
        if (t.phone) throw new Error("手機上看不到選單按鈕");
        return "";
      });
      page.off("pageerror", onError);
    }
    await context.close();
    rows.push(record);
  }
  await browser.close();
}
process.exitCode = report(rows) ? 1 : 0;
