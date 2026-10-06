// Theme files: read and patch in place, WCAG contrast, and the generator that
// makes new contrast-safe themes for the shared template markup.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  readTheme,
  patchTheme,
  contrast,
  contrastIssues,
  oklch,
  makeTheme,
  generateThemes,
  FONT_PAIRS,
  fontUrl,
  hueName,
} from "../src/site/themes.js";

const BASIC = fs.readFileSync("templates/basic/css/theme.css", "utf8");

test("readTheme: variables and the font import of a template", () => {
  const t = readTheme(BASIC);
  assert.ok(t);
  for (const k of ["--zone-research", "--zone-team", "--zone-publications", "--zone-join", "--ink", "--wall", "--plate", "--font", "--radius"])
    assert.ok(t.vars[k], k);
  assert.match(t.fontUrl, /^https:\/\/fonts\.googleapis\.com\/css2\?/);
  assert.equal(readTheme("body { color: red }"), null);
});

test("patchTheme: changes only the values asked for, keeps comments and order", () => {
  const out = patchTheme(BASIC, { vars: { "--zone-team": "#123456", "--nope": "#000" }, fontUrl: "https://fonts.googleapis.com/css2?family=Barlow&display=swap" });
  assert.equal(readTheme(out).vars["--zone-team"], "#123456");
  assert.equal(readTheme(out).fontUrl, "https://fonts.googleapis.com/css2?family=Barlow&display=swap");
  assert.ok(!out.includes("--nope"));
  // Everything else is byte-identical.
  const strip = (s) => s.replace(/--zone-team:[^;]+;/, "").replace(/@import\s+url\([^)]*\)\s*;/, "");
  assert.equal(strip(out), strip(BASIC));
  // Values cannot break out of the declaration.
  assert.ok(!patchTheme(BASIC, { vars: { "--ink": "red; } body { display:none" } }).includes("display:none }"));
  assert.equal(patchTheme(BASIC, {}), BASIC);
});

test("contrast: WCAG ratios", () => {
  assert.equal(Math.round(contrast("#000", "#fff") * 10) / 10, 21);
  assert.equal(contrast("#777777", "#777777"), 1);
  assert.equal(contrast("var(--x)", "#fff"), null);
  // The shipped template passes every pair it promises.
  assert.deepEqual(contrastIssues(readTheme(BASIC).vars), []);
  const bad = contrastIssues({ "--on-zone": "#ffffff", "--zone-research": "#7fd0c8" });
  assert.equal(bad.length, 1);
  assert.equal(bad[0].fg, "--on-zone");
});

test("oklch produces valid in-gamut hex colours", () => {
  for (const h of [0, 60, 120, 200, 280, 330]) assert.match(oklch(0.6, 0.2, h), /^#[0-9a-f]{6}$/);
  assert.equal(oklch(1, 0, 0), "#ffffff");
  assert.equal(oklch(0, 0, 0), "#000000");
});

test("makeTheme: every scheme and font pairing is contrast-safe", () => {
  for (const scheme of ["wayfinding", "analogous", "mono", "duo"])
    for (const hue of [10, 95, 170, 230, 300])
      for (const font of FONT_PAIRS) {
        const t = makeTheme({ hue, scheme, font, radius: 4 });
        assert.deepEqual(contrastIssues(t.vars), [], `${scheme} ${hue} ${font.id}`);
        assert.ok(t.vars["--font"].startsWith(`"${font.latin}"`));
      }
});

test("generateThemes: distinct, reproducible, applicable to the template", () => {
  const a = generateThemes({ count: 8, seed: 42 });
  const b = generateThemes({ count: 8, seed: 42 });
  assert.equal(a.length, 8);
  assert.deepEqual(a.map((t) => t.id), b.map((t) => t.id));
  assert.equal(new Set(a.map((t) => t.name)).size, 8);
  assert.notDeepEqual(generateThemes({ count: 8, seed: 7 }).map((t) => t.id), a.map((t) => t.id));
  // Spread: base hues cover the wheel, and every scheme and font shows up.
  for (const seed of [1, 2, 3, 1791293381715]) {
    const batch = generateThemes({ count: 6, seed });
    const hues = batch.map((t) => t.hue).sort((x, y) => x - y);
    const gaps = hues.map((h, i) => (i ? h - hues[i - 1] : h + 360 - hues.at(-1)));
    assert.ok(Math.max(...gaps) < 110, `seed ${seed} hues ${hues}`);
    assert.equal(new Set(batch.map((t) => t.scheme)).size, 4, `seed ${seed} schemes`);
    assert.equal(new Set(batch.map((t) => t.font)).size, 5, `seed ${seed} fonts`);
    // The skin keeps its own "you are here" mark; join is a dark zone.
    for (const t of batch) {
      assert.equal(t.vars["--mark"], undefined);
      assert.ok(contrast(t.vars["--zone-join"], "#ffffff") >= 4.5);
    }
  }
  for (const t of a) {
    const css = patchTheme(BASIC, t);
    const back = readTheme(css);
    assert.equal(back.vars["--zone-research"], t.vars["--zone-research"]);
    assert.equal(back.fontUrl, t.fontUrl);
    assert.deepEqual(contrastIssues(back.vars), []);
  }
});

test("font URLs and hue names", () => {
  assert.equal(
    fontUrl(FONT_PAIRS[0]),
    "https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700;900&family=Overpass:wght@400;600;700;800;900&display=swap",
  );
  assert.equal(hueName(0), "朱紅");
  assert.equal(hueName(359), "朱紅");
  assert.equal(hueName(210), "湖藍");
});
