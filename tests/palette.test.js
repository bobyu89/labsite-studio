// 網站配色 (one main colour, the palette follows) and block headings that
// copy the page's own section-heading style.
import test from "node:test";
import assert from "node:assert/strict";
import "./dom.js";
import { readPalette, recolorMap, applyColorMap, writePreview, stripPreview, hasPreview, toOklch, colorsRecord, restoreMap, normHex } from "../src/site/palette.js";
const { parsePage, serializePage, sectionElements, insertSection } = await import("../src/site/page.js");
const { adoptHeading } = await import("../src/site/albums.js");
const { blockById } = await import("../src/site/blockCatalog.js");

const CSS = `:root {
  --brand: #263B80;      /* 主品牌 深藍靛 — Logo */
  --pink: #FF79BC;
  --pink-bg: #FFF2F6;
  --ink: #374151;        /* 主文字 */
  --white: #FFFFFF;
  --shadow: 0 10px 30px rgba(255, 121, 188, 0.14);
  --grad: linear-gradient(135deg, #FF79BC, #263B80);
}
h1 { color: var(--brand); }
a { color: var(--brand); border-color: var(--pink); }
.x { color: var(--brand); }
`;

test("palette: colour variables with labels; the main colour is the most used clear colour", () => {
  const p = readPalette(CSS);
  assert.deepEqual(p.colors.map((c) => c.name), ["--brand", "--pink", "--pink-bg", "--ink", "--white"]);
  assert.equal(p.colors[0].label, "主品牌 深藍靛");
  assert.equal(p.primary.name, "--brand");
  assert.equal(normHex("#ABC"), "#aabbcc");
});

test("recolour: hue follows the main colour, lightness stays, greys and text colours stay", () => {
  const p = readPalette(CSS);
  const map = recolorMap(p, "#0d6557");
  assert.ok(map["#263b80"] && map["#ff79bc"] && map["#fff2f6"], "brand, accent and tinted ground change");
  assert.ok(!map["#374151"] && !map["#ffffff"], "ink and white stay");
  for (const [from, to] of Object.entries(map)) assert.ok(Math.abs(toOklch(from)[0] - toOklch(to)[0]) < 0.03, `${from}→${to} keeps its lightness`);
  const brandHue = toOklch(map["#263b80"])[2];
  assert.ok(Math.abs(brandHue - toOklch("#0d6557")[2]) < 8, "the main colour takes the chosen hue");
});

test("apply: hex in either case, short hex and rgb()/rgba() of palette colours are all replaced", () => {
  const map = { "#ff79bc": "#22aa66", "#263b80": "#0a5544" };
  const r = applyColorMap(`a{color:#FF79BC;b:#ff79bc} <stop stop-color="#263B80"/> x{c:rgba(255, 121, 188, 0.14);d:rgb(255,121,188)} y{e:#f7b}`, map);
  assert.equal(r.count, 5);
  assert.match(r.text, /color:#22AA66;b:#22aa66/);
  assert.match(r.text, /stop-color="#0A5544"/);
  assert.match(r.text, /rgba\(34, 170, 102, 0\.14\)/);
  assert.match(r.text, /rgb\(34, 170, 102\)/);
  assert.match(r.text, /#f7b/, "unrelated colours untouched");
});

test("preview: a marked :root override that comes off cleanly; restore maps back to the original", () => {
  const p = readPalette(CSS);
  const map = recolorMap(p, "#c7256d");
  const prev = writePreview(CSS, map);
  assert.ok(hasPreview(prev));
  assert.match(prev, /--shadow: 0 10px 30px rgba\(/, "shadows and gradients that use the colours are in the override");
  assert.equal(stripPreview(prev), CSS);
  assert.equal(readPalette(prev).primary.value, "#263b80", "the palette is read from the real values, not the preview");
  const record = colorsRecord(null, p);
  const applied = applyColorMap(CSS, map).text;
  const back = applyColorMap(applied, restoreMap(record, readPalette(applied))).text;
  assert.equal(back.toLowerCase(), CSS.toLowerCase());
  assert.equal(colorsRecord(record, readPalette(applied)), record, "the original is remembered only once");
});

test("headings: a new block copies the page's own heading (icon, title, English kicker) with unique ids", () => {
  const html = `<!DOCTYPE html><html><head><title>t</title></head><body>
<section class="hero"><h1>主視覺</h1></section>
<section class="section"><div class="container"><div class="section-header reveal"><h2 class="section-header__title"><span class="icon"><svg><defs><linearGradient id="g1"><stop/></linearGradient></defs><rect fill="url(#g1)"/></svg></span>
          研究團隊
        </h2><span class="mono-en">TEAM</span></div><p>x</p></div></section>
<footer>f</footer></body></html>`;
  const page = parsePage(html);
  insertSection(page.doc, 1, blockById("stats").html(), "index.html");
  const sec = sectionElements(page.doc)[2];
  assert.equal(adoptHeading(page.doc, sec, { kicker: "AT A GLANCE" }), true);
  const head = sec.querySelector(".section-header");
  assert.ok(head, "the wrapper is copied");
  assert.equal(head.querySelector("h2").textContent.trim(), "研究成果一覽");
  assert.equal(head.querySelector(".mono-en").textContent, "AT A GLANCE");
  assert.ok(!sec.querySelector(".ls-title"));
  assert.ok(sec.querySelector(":scope > .container"), "the page's content width is used too");
  const ids = [...page.doc.querySelectorAll("[id]")].map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, "ids stay unique");
  assert.match(head.querySelector("rect").getAttribute("fill"), /^url\(#g1-ls/);
  assert.ok(serializePage(page).includes("研究團隊"), "the original heading is untouched");
  // A page without any section heading keeps the block's own.
  const bare = parsePage("<!DOCTYPE html><html><head></head><body><section><h1>x</h1></section></body></html>");
  insertSection(bare.doc, 0, blockById("quote").html(), "index.html");
  assert.equal(adoptHeading(bare.doc, sectionElements(bare.doc)[1]), false);
});
