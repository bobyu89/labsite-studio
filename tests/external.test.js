// Pages we did not write: the Greene Lab template (Jekyll). Two questions:
// does an unmodified save stay byte-for-byte identical, and does the editor
// stay on its feet when the page has no <body>-level <section> at all?
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import "./dom.js";
const { parsePage, roundTrip, listSections, sectionElements, collectFields, readHead, editHtml, structureSignature } =
  await import("../src/site/page.js");

const dir = fileURLToPath(new URL("./fixtures/greenelab/", import.meta.url));
const pages = readdirSync(dir)
  .filter((f) => f.endsWith(".html"))
  .map((f) => [f, readFileSync(dir + f, "utf8")]);

test("greenelab fixtures are present", () => {
  assert.ok(pages.length >= 6, "expected the six downloaded pages");
});

for (const [name, html] of pages) {
  test(`greenelab/${name}: unmodified round trip is byte-for-byte identical`, () => {
    assert.equal(roundTrip(html), html);
    // editHtml with a no-op mutation is what "save without changes" runs.
    assert.equal(editHtml(html, () => {}), html);
  });

  test(`greenelab/${name}: no body-level sections, but nothing throws`, () => {
    const { doc } = parsePage(html);
    // Documented limitation: this template nests <section> inside <main>.
    assert.deepEqual(listSections(doc), []);
    assert.equal(sectionElements(doc).length, 0);
    assert.ok(doc.querySelectorAll("main section").length > 0, "the sections are there, just nested");
    // Head editing and field collection over the whole body still work.
    const head = readHead(doc);
    assert.ok(head.title.length > 0);
    const fields = collectFields(doc.body);
    assert.ok(fields.length > 20, "body still yields editable fields");
    // The Google Fonts <link> carries `&amp;` in its href: decoded on parse,
    // re-escaped and restored on save (covered by the round-trip test above).
    const fonts = [...doc.querySelectorAll("link[href]")].map((l) => l.getAttribute("href"));
    assert.ok(fonts.some((h) => h.includes("&") && !h.includes("&amp;")), "href entities are decoded on parse");
    assert.equal(typeof structureSignature(doc), "string");
  });
}
