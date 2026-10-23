import test from "node:test";
import assert from "node:assert/strict";
import "./dom.js";
import { parsePage, sectionElements, applyInlineText, editHtml, pathOf } from "../src/site/page.js";
import { buildPreview, createPreviewCache } from "../src/site/preview.js";

const PAGE = [
  "<!DOCTYPE html>",
  '<html lang="zh-Hant">',
  "<head><title>t</title></head>",
  "<body>",
  '  <section class="section hero">',
  '    <h1 class="hero__title">',
  '      以<span class="hl">護理科學</span>，培育人才',
  "    </h1>",
  '    <p class="lede">一句介紹。</p>',
  '    <div class="card"><img src="a.png" alt=""><p>卡片</p></div>',
  '    <p><span class="stat__value">30</span></p>',
  '    <span class="avatar">游</span>',
  "  </section>",
  "</body>",
  "</html>",
  "",
].join("\n");

const h1Path = (doc) => pathOf(doc.querySelector("h1"), sectionElements(doc)[0]);

test("typed text lands on the right text nodes and keeps the file's indentation", () => {
  const { doc } = parsePage(PAGE);
  const path = h1Path(doc);
  const h1 = doc.querySelector("h1");
  // What the preview reports: every text node under the h1, in order.
  const before = ["\n      以", "護理科學", "，培育人才\n    "];
  const changes = [
    [[0], before[0], "\n      以"],
    [[1, 0], before[1], "實證護理"],
    [[2], before[2], "，培育下一代人才\n    "],
  ];
  assert.equal(h1.childNodes.length, 3);
  const out = editHtml(PAGE, (d) => applyInlineText(sectionElements(d)[0], path, changes));
  assert.ok(out.includes('      以<span class="hl">實證護理</span>，培育下一代人才\n    </h1>'));
  assert.equal(out.split("\n").length, PAGE.split("\n").length);
  // Nothing changed: the page string stays identical.
  assert.equal(editHtml(PAGE, (d) => applyInlineText(sectionElements(d)[0], path, changes.map(([p, b]) => [p, b, b]))), PAGE);
});

test("stale or foreign reports are ignored, and typed no-break spaces become spaces", () => {
  const { doc } = parsePage(PAGE);
  const s = sectionElements(doc)[0];
  const lede = pathOf(doc.querySelector(".lede"), s);
  // The page no longer holds what the preview started from: skip.
  assert.equal(applyInlineText(s, lede, [[[0], "別的內容", "新內容"]]), false);
  // Not a text node, or a bad shape: skip.
  assert.equal(applyInlineText(s, lede, [[[5], "x", "y"], ["bad", "x", "y"], [[0], 1, 2]]), false);
  assert.equal(applyInlineText(s, lede, [[[0], "一句介紹。", "新的 介紹 "]]), true);
  assert.equal(doc.querySelector(".lede").textContent, "新的 介紹");
  // Already applied (a repeated report): still fine.
  assert.equal(applyInlineText(s, lede, [[[0], "一句介紹。", "新的 介紹 "]]), false);
});

test("the preview marks plain text as typeable, but not cards, photos or animated numbers", async () => {
  const source = { readText: async () => null, readBlob: async () => null };
  const { srcdoc } = await buildPreview({ html: PAGE, pagePath: "index.html", source, cache: createPreviewCache(), inline: true });
  const doc = parsePage(srcdoc).doc;
  const typeable = [...doc.querySelectorAll("[data-ls-text]")].map((el) => el.tagName.toLowerCase() + (el.className ? "." + el.className.split(" ")[0] : ""));
  assert.deepEqual(typeable, ["h1.hero__title", "span.hl", "p.lede", "p"]);
  assert.ok(srcdoc.includes("window.__lsInline=1;"));
  const off = await buildPreview({ html: PAGE, pagePath: "index.html", source, cache: createPreviewCache() });
  assert.ok(!off.srcdoc.includes("window.__lsInline=1;"));
});
