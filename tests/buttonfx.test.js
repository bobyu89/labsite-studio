// 按鈕動態: one ls-fx-* class per button, runtime CSS present, reduced motion respected.
import test from "node:test";
import assert from "node:assert/strict";
import "./dom.js";
const { parsePage, sectionElements, collectFields, setButtonFx, editHtml } = await import("../src/site/page.js");
const { BUTTON_FX, ANIM_CSS_TEXT } = await import("../src/site/blockRuntime.js");

const page = `<!DOCTYPE html>\n<html lang="zh-Hant">\n<head><title>t</title></head>\n<body>\n  <section class="hero">\n    <a class="btn btn--primary" href="join.html">加入我們</a>\n    <a href="contact.html">聯絡</a>\n  </section>\n</body>\n</html>\n`;
const link = (html, i) => collectFields(sectionElements(parsePage(html).doc)[0]).filter((f) => f.kind === "link")[i];

test("a button gets exactly one effect, keeps its own classes, and can lose it again", () => {
  const path = link(page, 0).path;
  const lifted = editHtml(page, (doc) => setButtonFx(sectionElements(doc)[0], path, "lift"));
  assert.match(lifted, /class="btn btn--primary ls-fx-lift"/);
  assert.equal(link(lifted, 0).fx, "lift");
  const shine = editHtml(lifted, (doc) => setButtonFx(sectionElements(doc)[0], path, "shine"));
  assert.match(shine, /class="btn btn--primary ls-fx-shine"/);
  assert.equal(editHtml(shine, (doc) => setButtonFx(sectionElements(doc)[0], path, "")), page);
  // A plain link without classes: the attribute appears and goes away cleanly.
  const p2 = link(page, 1).path;
  const arrow = editHtml(page, (doc) => setButtonFx(sectionElements(doc)[0], p2, "arrow"));
  assert.match(arrow, /<a (class="ls-fx-arrow" href="contact.html"|href="contact.html" class="ls-fx-arrow")>/);
  assert.equal(editHtml(arrow, (doc) => setButtonFx(sectionElements(doc)[0], p2, "")), page);
});

test("every effect has CSS, inside the reduced-motion guard", () => {
  const guarded = ANIM_CSS_TEXT.slice(ANIM_CSS_TEXT.indexOf("@media (prefers-reduced-motion: no-preference)"));
  for (const [id] of BUTTON_FX.filter(([id]) => id)) assert.match(guarded, new RegExp("\\.ls-fx-" + id + "\\b"), id);
});
