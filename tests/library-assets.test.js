// 素材庫 (icons, people, décor) and 動畫庫 (animated components + runtime).
import test from "node:test";
import assert from "node:assert/strict";
import "./dom.js";
import { colorIcon, iconAssetPath, searchIcons, DECOR, decorAssetPath, tint, personAssetPath, validColor, EXTERNAL_SOURCES } from "../src/site/assetLibrary.js";
import { BLOCK_CATALOG, ENTRANCES, blockById } from "../src/site/blockCatalog.js";
import { RUNTIME_FILES, BLOCKS_JS, BLOCKS_CSS, ensureBlockAssets } from "../src/site/albums.js";
import { bundleIcons } from "../tools/bundle-library.js";
const { parsePage, serializePage, sectionElements, insertSection, describeNode } = await import("../src/site/page.js");

test("icons: the curated Health Icons bundle has Chinese names, both styles, and its licence", () => {
  const b = bundleIcons();
  assert.equal(b.license, "MIT");
  assert.ok(b.icons.length >= 100);
  for (const i of b.icons) {
    assert.ok(i.name && i.group && i.outline && i.filled, i.id);
    assert.match(i.outline, /currentColor/);
  }
  const nurse = b.icons.find((i) => i.id === "nurse");
  const svg = colorIcon(nurse.outline, "#2563a8");
  assert.ok(!svg.includes("currentColor") && svg.includes("#2563a8"));
  assert.match(svg, /Health Icons.*MIT/);
  assert.equal(iconAssetPath("nurse", "outline", "#2563A8"), "assets/library/icons/nurse-outline-2563a8.svg");
  assert.deepEqual(searchIcons(b.icons, "聽診").map((i) => i.id), ["stethoscope"]);
  assert.ok(searchIcons(b.icons, "", "人物").every((i) => i.group === "人物"));
});

test("décor: every pattern is a valid, deterministic SVG in the chosen colour", () => {
  for (const d of DECOR) {
    const a = d.svg("#8e2a5e");
    assert.equal(a, d.svg("#8e2a5e"), d.id + " is deterministic");
    assert.match(a, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.ok(a.includes(tint("#8e2a5e", 0.94)) || a.includes("#8e2a5e") || /#[0-9a-f]{6}/.test(a));
    const doc = new DOMParser().parseFromString(a, "image/svg+xml");
    assert.equal(doc.documentElement.tagName.toLowerCase(), "svg", d.id);
  }
  assert.equal(tint("#000000", 1), "#ffffff");
  assert.equal(decorAssetPath("ecg-line", "#0D6557"), "assets/library/decor/ecg-line-0d6557.svg");
  assert.equal(personAssetPath("open-peeps", "A b!", "#ffffff"), "assets/library/people/open-peeps-a-b-ffffff.svg");
  assert.ok(validColor("#abcdef") && !validColor("red"));
  assert.ok(EXTERNAL_SOURCES.every((s) => /^https:\/\//.test(s.url) && s.note.includes("再散布")), "outside sources explain why they are not bundled");
});

test("animated components: each inserts as one editable section that loads the runtime", () => {
  for (const b of BLOCK_CATALOG) {
    const page = parsePage("<!DOCTYPE html><html><head><title>t</title></head><body><section><h1>x</h1></section><footer>f</footer></body></html>");
    assert.equal(insertSection(page.doc, 0, b.html({}), "en/index.html"), true, b.id);
    ensureBlockAssets(page.doc, "en/index.html");
    const added = sectionElements(page.doc)[1];
    assert.match(added.className, /ls-block/, b.id);
    const { fields, lists } = describeNode(added, added);
    assert.ok(fields.length + lists.length > 0, b.id + " has something to edit");
    const out = serializePage(page);
    assert.match(out, /\.\.\/js\/labsite-blocks\.js/, b.id);
    if (b.image) assert.match(out, /src="\.\.\/assets\/library\/placeholder-photo\.svg"/);
  }
  assert.ok(blockById("stats") && !blockById("nope"));
  assert.deepEqual(ENTRANCES.map(([id]) => id), ["", "fade", "rise", "zoom", "left", "right", "stagger"]);
});

test("runtime: entrance animations and components are in the shipped files, ES5 and reduced-motion aware", () => {
  const js = RUNTIME_FILES[BLOCKS_JS];
  const css = RUNTIME_FILES[BLOCKS_CSS];
  for (const name of ["countUp", "startTabs", "startMarquees", "startAnimations", "IntersectionObserver"]) assert.ok(js.includes(name), name);
  assert.ok(!/=>|\blet\b|\bconst\b|`/.test(js.replace(/\/\*[\s\S]*?\*\//g, "")), "plain ES5");
  new Function(js);
  for (const sel of ['[data-ls-anim="rise"]', ".ls-stats", ".ls-timeline", ".ls-tab-buttons", ".ls-faq", ".ls-marquee", ".ls-progress", ".ls-card", ".ls-split", ".ls-cta"]) assert.ok(css.includes(sel), sel);
  assert.ok((css.match(/prefers-reduced-motion/g) || []).length >= 6);
});
