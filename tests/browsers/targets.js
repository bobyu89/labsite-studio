import { chromium, firefox, webkit, devices } from "playwright";

// The browsers and devices every browser check runs in. Phones and tablets are
// Playwright's emulation (WebKit for Apple devices, Chromium for Android):
// right screen size, touch and user agent, but not the real Safari on iOS.
export const TARGETS = [
  { id: "chromium", name: "Chrome／Edge（Chromium）", type: chromium, context: { viewport: { width: 1440, height: 900 } } },
  { id: "firefox", name: "Firefox", type: firefox, context: { viewport: { width: 1440, height: 900 } } },
  { id: "webkit", name: "Safari（WebKit）", type: webkit, context: { viewport: { width: 1440, height: 900 } } },
  { id: "ipad", name: "iPad（WebKit 模擬）", type: webkit, context: devices["iPad (gen 11)"], touch: true },
  { id: "iphone", name: "iPhone 15（WebKit 模擬）", type: webkit, context: devices["iPhone 15"], touch: true, phone: true },
  { id: "pixel", name: "Pixel 8（Chromium 模擬）", type: chromium, context: devices["Pixel 8"], touch: true, phone: true },
];

export function pickTargets(argv) {
  const only = argv.find((a) => a.startsWith("--only="))?.slice(7).split(",");
  return only ? TARGETS.filter((t) => only.includes(t.id)) : TARGETS;
}

// Page-level overflow: a page wider than the screen scrolls sideways on phones.
// Measured on the scrolling element, so content a site clips (overflow-x:
// clip, e.g. a closed off-canvas menu) does not count.
export async function overflow(page) {
  return page.evaluate(() => {
    const root = document.scrollingElement || document.documentElement;
    const width = root.clientWidth;
    const scroll = root.scrollWidth;
    if (scroll <= width + 1) return null;
    const wide = [...document.querySelectorAll("body *")]
      .filter((el) => el.getBoundingClientRect().right > width + 1 && getComputedStyle(el).position !== "fixed")
      .slice(0, 4)
      .map((el) => el.tagName.toLowerCase() + (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/)[0] : ""));
    return `頁面寬 ${scroll}px，螢幕 ${width}px（${wide.join("、")}）`;
  });
}

export function report(rows) {
  let failed = 0;
  for (const r of rows) {
    console.log(`\n${r.ok ? "✔" : "✘"} ${r.target}`);
    for (const s of r.steps) {
      if (!s.ok) failed++;
      console.log(`  ${s.ok ? "✔" : "✘"} ${s.name}${s.note ? "：" + s.note : ""}`);
    }
  }
  console.log(failed ? `\n${failed} 項失敗` : "\n全部通過");
  return failed;
}

// Runs named steps in order; a failed step stops the rest for that target.
export function stepper(record) {
  let broken = false;
  return async (name, fn) => {
    if (broken) return record.steps.push({ name, ok: false, note: "前一步失敗，略過" });
    try {
      const note = await fn();
      record.steps.push({ name, ok: true, note: typeof note === "string" ? note : "" });
    } catch (e) {
      broken = true;
      record.ok = false;
      // Playwright's call log says why an action waited (covered, hidden…).
      const lines = String(e?.message || e).split("\n");
      if (process.env.LABSITE_DEBUG) console.error(lines.join("\n"));
      const why = lines.filter((l) => /intercepts|not visible|outside of the viewport|not stable|not enabled/.test(l)).pop();
      record.steps.push({ name, ok: false, note: lines[0] + (why ? "｜" + why.trim() : "") });
    }
  };
}

export async function until(fn, { timeout = 10000, message = "逾時" } = {}) {
  const end = Date.now() + timeout;
  let last;
  while (Date.now() < end) {
    try {
      last = await fn();
      if (last) return last;
    } catch (e) {
      last = e;
    }
    await new Promise((r) => setTimeout(r, 120));
  }
  throw new Error(message + (last instanceof Error ? "（" + last.message.split("\n")[0] + "）" : ""));
}
