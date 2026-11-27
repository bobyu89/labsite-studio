// v4.29 一鍵修正: fixes with one right answer, as pure functions.
import test from "node:test";
import assert from "node:assert/strict";
import "./dom.js";
import { DOMParser } from "linkedom";
globalThis.DOMParser = globalThis.DOMParser || DOMParser;
const { typesetZh, typesetChanges, applyTypeset, pdfLinks, applyPdfLabels, targetShape, offShape, cropBox, replaceImageSrc, setMissingAlt } = await import("../src/site/autofix.js");
const { editHtml } = await import("../src/site/page.js");

test("typesetZh: spaces between Chinese and Latin text, full-width punctuation, dates left closed", () => {
  const cases = [
    ["本研究室有86位長輩參加COVID-19疫情調查", "本研究室有 86 位長輩參加 COVID-19 疫情調查"],
    ["2026年11月26日14時，第3屆研討會", "2026年11月26日14時，第3屆研討會"],
    ["我們使用AI(人工智慧)工具?真的!", "我們使用 AI（人工智慧）工具？真的！"],
    ["電話:02-1234", "電話：02-1234"],
    ["研究室 ， 歡迎加入", "研究室，歡迎加入"],
    ["Plain English stays, as is: yes.", "Plain English stays, as is: yes."],
    ["已經是 AI 時代", "已經是 AI 時代"],
  ];
  for (const [from, to] of cases) assert.equal(typesetZh(from), to, from);
  assert.equal(typesetZh(typesetZh(cases[0][0])), cases[0][1], "running twice changes nothing more");
});

test("typesetChanges: text only, never code, scripts, English blocks or English pages", () => {
  const html = `<html lang="zh-Hant"><body><h1>研究室有3位老師</h1><p>使用<code>Python程式</code>分析</p><p lang="en">Lab of 3人</p><script>var a="中文A";</script><a href="x.html" title="中文A">中文A</a></body></html>`;
  const doc = new DOMParser().parseFromString(html, "text/html");
  assert.deepEqual(typesetChanges(doc).map((c) => c.after), ["研究室有 3 位老師", "中文 A"]);
  const out = editHtml(html, applyTypeset);
  assert.match(out, /研究室有 3 位老師/);
  assert.match(out, /<code>Python程式<\/code>/);
  assert.match(out, /title="中文A"/, "attributes untouched");
  const en = new DOMParser().parseFromString('<html lang="en"><body><p>中文A</p></body></html>', "text/html");
  assert.deepEqual(typesetChanges(en), []);
});

test("PDF links say what they are, with the size when the file is on the site", () => {
  const html = `<html><body><a href="files/brochure.pdf"><i class="icon"></i> 招生簡章 </a><a href="https://x.org/a.pdf">計畫書</a><a href="b.pdf">簡章（PDF，1 MB）</a><a href="c.html">頁面</a></body></html>`;
  const sizes = new Map([["files/brochure.pdf", 1258291]]);
  const doc = new DOMParser().parseFromString(html, "text/html");
  assert.deepEqual(pdfLinks(doc, "index.html", sizes).map((x) => x.after), ["招生簡章（PDF，1.2 MB）", "計畫書（PDF）"]);
  const out = editHtml(html, applyPdfLabels("index.html", sizes));
  assert.match(out, /<i class="icon"><\/i> 招生簡章（PDF，1\.2 MB） <\/a>/);
  assert.match(editHtml('<html><body><a href="../files/x.pdf">Brochure</a></body></html>', applyPdfLabels("en/index.html", new Map([["files/x.pdf", 2048]]))), /Brochure \(PDF, 2 KB\)/);
});

test("member photos: the shape most have, which are off, and a crop that keeps heads", () => {
  const shape = targetShape([{ w: 400, h: 400 }, { w: 600, h: 600 }, { w: 400, h: 500 }, { w: 800, h: 600 }]);
  assert.deepEqual(shape, { ratio: 1, name: "正方形 1:1" });
  assert.deepEqual(targetShape([{ w: 400, h: 500 }, { w: 800, h: 1000 }, { w: 300, h: 300 }]).name, "直式 4:5");
  assert.equal(offShape({ w: 400, h: 404 }, 1), false);
  assert.equal(offShape({ w: 400, h: 500 }, 1), true);
  assert.deepEqual(cropBox(600, 900, 1), { x: 0, y: 75, w: 600, h: 600 }, "tall: a quarter of the spare height above");
  assert.deepEqual(cropBox(900, 600, 1), { x: 150, y: 0, w: 600, h: 600 }, "wide: centred");
  assert.deepEqual(cropBox(800, 800, 0.8), { x: 80, y: 0, w: 640, h: 800 });
});

test("a new photo replaces the old one on every page that shows it; alt text fills only what is missing", () => {
  const zh = '<html><body><img src="assets/a.jpg"><img src="assets/b.jpg" alt=""><img src="assets/a.jpg" alt="舊的"></body></html>';
  const en = '<html><body><img src="../assets/a.jpg"></body></html>';
  assert.equal((editHtml(zh, replaceImageSrc("index.html", "assets/a.jpg", "assets/a-1a2b3c.webp")).match(/assets\/a-1a2b3c\.webp/g) || []).length, 2);
  assert.match(editHtml(en, replaceImageSrc("en/index.html", "assets/a.jpg", "assets/a-1a2b3c.webp")), /src="\.\.\/assets\/a-1a2b3c\.webp"/);
  const out = editHtml(zh, setMissingAlt("index.html", "assets/a.jpg", "研究室成員合照"));
  assert.equal((out.match(/alt="研究室成員合照"/g) || []).length, 1, "only the image without alt (linkedom may reorder attributes)");
  assert.match(out, /alt="舊的"/);
  assert.match(out, /<img src="assets\/b\.jpg" alt="">/, "an empty alt is a choice (decorative), kept");
});
