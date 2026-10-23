// The editor's main flows in Chromium, Firefox, WebKit and phone/tablet
// emulation: open a site, type in the preview, drag a section, add a map,
// save, and create a page. The built editor (dist/, what Pages serves) runs
// under `vite preview` on port 4188; each target edits a fresh copy of
// templates/basic through the /__labsite/ bridge.
//
//   npm run test:browsers                 build, then every target
//   npm run test:browsers -- --only=webkit,iphone --no-build
//   npm run test:browsers -- --shots=DIR  also save a screenshot per target
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { build } from "vite";
import { pickTargets, overflow, report, stepper, until } from "./targets.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PORT = 4188; // not 4190: browsers refuse that port (sieve)
const work = fs.mkdtempSync(path.join(os.tmpdir(), "labsite-browsers-"));
const site = path.join(work, "basic");
const shots = process.argv.find((a) => a.startsWith("--shots="))?.slice(8);
const read = (p) => fs.readFileSync(path.join(site, p), "utf8");
const exists = (p) => fs.existsSync(path.join(site, p));

function freshSite() {
  fs.rmSync(site, { recursive: true, force: true });
  fs.cpSync(path.join(ROOT, "templates/basic"), site, { recursive: true });
}

freshSite();
if (!process.argv.includes("--no-build")) await build({ root: ROOT, configFile: path.join(ROOT, "vite.config.js"), logLevel: "warn" });
// A separate process: with the server inside this one, Firefox and WebKit
// page loads stall or restart.
const server = spawn(
  process.execPath,
  [path.join(ROOT, "node_modules/vite/bin/vite.js"), "preview", "--host", "127.0.0.1", "--port", String(PORT), "--strictPort"],
  { cwd: ROOT, env: { ...process.env, LABSITE_SITE_DIR: site }, stdio: "ignore" },
);
await until(() => fetch(`http://127.0.0.1:${PORT}/__labsite/info`).then((r) => r.ok), { timeout: 30000, message: "預覽伺服器沒有啟動" });

const rows = [];
try {
  for (const t of pickTargets(process.argv)) rows.push(await run(t));
} finally {
  server.kill();
  fs.rmSync(work, { recursive: true, force: true });
}
process.exitCode = report(rows) ? 1 : 0;

async function run(t) {
  freshSite();
  const record = { target: t.name, ok: true, steps: [] };
  const step = stepper(record);
  const browser = await t.type.launch();
  const context = await browser.newContext(t.context);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.split("\n")[0]));
  const press = (locator) => (t.touch ? locator.tap() : locator.click());
  const preview = page.frameLocator('iframe[title="真實網站預覽"]');
  const sectionTitles = () => page.locator(".section-list .section-title").allTextContents();
  const fieldHas = (text) =>
    page.evaluate((v) => [...document.querySelectorAll(".inspector input, .inspector textarea")].some((e) => e.value === v), text);

  await step("打開編輯器並開啟網站", async () => {
    await page.goto(`http://127.0.0.1:${PORT}/`);
    const nav = page.locator("nav .nav-item", { hasText: "真實網站" });
    await nav.waitFor({ state: "attached" });
    // Phones: the sidebar slides in from the menu button.
    const menu = page.getByRole("button", { name: "開啟導覽" });
    if (await menu.isVisible()) {
      await press(menu);
      await page.waitForTimeout(400);
    }
    await press(nav);
    await press(page.getByRole("button", { name: "開啟 basic" }));
    await preview.locator("h1.directory__title[data-ls-text]").waitFor({ timeout: 15000 });
  });

  await step("在預覽裡直接打字改標題", async () => {
    const h1 = preview.locator("h1.directory__title");
    await press(h1);
    await until(() => h1.evaluate((el) => el.isContentEditable), { message: "標題沒有變成可輸入" });
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("實證護理研究室");
    await page.keyboard.press("Enter");
    await until(() => h1.evaluate((el) => !el.isContentEditable), { message: "按 Enter 沒有結束輸入" });
    await until(() => fieldHas("實證護理研究室"), { message: "左邊欄位沒有跟著更新" });
    const shown = (await h1.textContent()).trim();
    if (shown !== "實證護理研究室") throw new Error("預覽顯示「" + shown + "」");
  });

  await step(t.touch ? "用手指拖曳區塊排序" : "用滑鼠拖曳區塊排序", async () => {
    const before = await sectionTitles();
    const handle = page.locator(".section-list .drag-handle").nth(1);
    const target = page.locator(".section-list [data-row]").nth(2);
    await target.scrollIntoViewIfNeeded();
    await handle.scrollIntoViewIfNeeded();
    const a = await handle.boundingBox();
    const b = await target.boundingBox();
    const from = { x: a.x + a.width / 2, y: a.y + a.height / 2 };
    const to = { x: from.x, y: b.y + b.height * 0.85 };
    if (!t.touch) {
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(to.x, to.y, { steps: 10 });
      await page.mouse.up();
    } else if (t.type.name() === "chromium") {
      const cdp = await context.newCDPSession(page);
      const touch = (type, p) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: p ? [{ x: p.x, y: p.y }] : [] });
      await touch("touchStart", from);
      for (let i = 1; i <= 10; i++) await touch("touchMove", { x: from.x, y: from.y + ((to.y - from.y) * i) / 10 });
      await touch("touchEnd");
      // After synthetic CDP touches Chromium drops the click of the next tap
      // (also after dragging plain text, so not the editor): tap plain text.
      await page.locator(".canvas-caption").tap();
    } else {
      // WebKit has no touch-move API in Playwright: use the 下移 button.
      await press(page.locator(".section-list .section-pick").nth(1));
      await press(page.locator(".section-list .section-actions").getByRole("button", { name: "下移" }));
    }
    const want = [before[0], before[2], before[1], ...before.slice(3)];
    await until(async () => JSON.stringify(await sectionTitles()) === JSON.stringify(want), {
      message: "順序沒有改變：" + before.join("、"),
    });
    return t.touch && t.type.name() !== "chromium" ? "WebKit 無法模擬手指拖曳，改按「下移」" : "";
  });

  await step("加入 Google 地圖區塊", async () => {
    const before = (await sectionTitles()).length;
    await press(page.getByRole("button", { name: "＋ 影片／地圖" }));
    const dialog = page.getByRole("dialog");
    await press(dialog.getByRole("radio", { name: "Google 地圖" }));
    await dialog.getByLabel("地圖網址、嵌入程式碼或地址").fill("國防醫學大學護理學院");
    await press(dialog.getByRole("button", { name: "加入", exact: true }));
    await until(async () => (await sectionTitles()).length === before + 1, { message: "區塊沒有加進清單" });
    await preview.locator(".ls-embed").first().waitFor({ timeout: 10000 });
  });

  await step("保存並寫回檔案", async () => {
    await press(page.getByRole("button", { name: "保存", exact: true }));
    await until(() => {
      const html = read("index.html");
      return html.includes(">實證護理研究室<") && html.includes("output=embed") && html.indexOf('class="news"') < html.indexOf('class="statement"') && exists("css/labsite-blocks.css");
    }, { message: "index.html 沒有寫入預期的修改" });
    // The move was copied to the English page, which 保存 (this page only)
    // leaves unsaved: 全部保存 must be offered.
    const all = page.getByRole("button", { name: /^全部保存/ });
    await press(all);
    await until(() => {
      const en = read("en/index.html");
      return en.indexOf('class="news"') < en.indexOf('class="statement"');
    }, { message: "英文頁的排序沒有一起保存" });
    await all.waitFor({ state: "detached" });
  });

  await step("新增頁面（中英各一頁並放進選單）", async () => {
    await press(page.getByRole("button", { name: "頁面與選單" }));
    await press(page.getByRole("button", { name: "新增頁面" }));
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("頁面名稱（中文）").fill("招生說明會");
    await dialog.getByLabel("英文名稱").fill("Open Day");
    await press(dialog.getByRole("button", { name: "建立頁面" }));
    await until(() => exists("open-day.html") && exists("en/open-day.html") && read("js/data.js").includes("open-day"), {
      message: "新頁面或選單沒有寫入",
    });
    await until(async () => (await preview.locator("h1").first().textContent()).includes("招生說明會"), {
      message: "編輯器沒有切到新頁面",
    });
  });

  await step("畫面沒有左右溢出", async () => {
    const wide = await overflow(page);
    if (wide) throw new Error(wide);
  });

  await step("沒有 JavaScript 錯誤", async () => {
    if (errors.length) throw new Error(errors.slice(0, 3).join("；"));
  });

  if (shots) {
    fs.mkdirSync(shots, { recursive: true });
    await page.screenshot({ path: path.join(shots, `editor-${t.id}.png`) }).catch(() => {});
  }
  await browser.close();
  return record;
}
