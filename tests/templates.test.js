// Every shipped template must be editable by the same engine as any site:
// pages round-trip byte for byte, zh/en pairs line up, every library snippet
// inserts cleanly into every page, and nothing points at a missing file.
import test from "node:test";
import assert from "node:assert/strict";
import "./dom.js";
import { bundleTemplates } from "../tools/bundle-templates.js";
import { personalize } from "../cloud/src/templates.js";
import { enc, dec } from "../cloud/src/bytes.js";
const { parsePage, roundTrip, listSections, sectionElements, editHtml, insertSection, structureSignature, describeNode, pairOf } =
  await import("../src/site/page.js");
const { parseLibrary } = await import("../src/site/library.js");
const { readSiteFields } = await import("../src/site/siteData.js");
const { resolveFrom, isPagePath } = await import("../src/site/source.js");

const { index, bundles } = bundleTemplates();

test("at least one template ships, each with metadata", () => {
  assert.ok(index.length >= 1);
  for (const t of index) {
    assert.ok(t.name && t.name !== t.id, t.id + " has a name");
    assert.ok(t.description, t.id + " has a description");
  }
});

for (const [id, bundle] of Object.entries(bundles)) {
  const files = new Map(bundle.files.map((f) => [f.path, f]));
  const textOf = (p) => files.get(p)?.text;
  const pages = [...files.keys()].filter(isPagePath).sort();
  const library = parseLibrary(textOf("labsite/library.json"));

  // Local references (src, href, CSS url()) of a page must exist in the template.
  const missingRefs = (html, pagePath) => {
    const { doc } = parsePage(html);
    const out = [];
    for (const el of doc.querySelectorAll("[src], [href]")) {
      const ref = el.getAttribute("src") ?? el.getAttribute("href");
      const path = resolveFrom(pagePath, ref);
      if (path && !files.has(path)) out.push(ref);
    }
    return out;
  };

  test(`${id}: pages round-trip unchanged and have editable sections`, () => {
    assert.ok(pages.includes("index.html") && pages.includes("en/index.html"));
    for (const p of pages) {
      const html = textOf(p);
      assert.equal(roundTrip(html), html, p + " round-trips");
      assert.equal(editHtml(html, () => true), html, p + " no-op edit");
      assert.ok(listSections(parsePage(html).doc).length >= 2, p + " has sections");
      assert.deepEqual(missingRefs(html, p), [], p + " references");
    }
  });

  test(`${id}: every zh page has an en twin with the same structure`, () => {
    for (const p of pages.filter((x) => !x.startsWith("en/"))) {
      const other = pairOf(p, pages);
      assert.ok(other, p + " has an English page");
      assert.equal(structureSignature(parsePage(textOf(p)).doc), structureSignature(parsePage(textOf(other)).doc), p);
    }
  });

  test(`${id}: repeated content is detected as editable lists`, () => {
    const lists = (path) =>
      sectionElements(parsePage(textOf(path)).doc).flatMap((s) => describeNode(s).lists.map((l) => l.label + ":" + l.items.length));
    assert.ok(lists("index.html").includes("導引色帶:4"), "directory bands");
    assert.ok(lists("members.html").some((l) => l.startsWith("成員:")), "member grid");
    assert.ok(lists("publications.html").some((l) => l.startsWith("文獻:")), "publication list");
    assert.ok(lists("research.html").includes("計畫:3"), "project rows");
    assert.ok(lists("members.html").includes("畢業成員:3"), "alumni");
  });

  test(`${id}: site data is editable`, () => {
    const fields = readSiteFields(textOf("js/data.js")).fields.map((f) => f.key);
    for (const k of ["nameZh", "nameEn", "email", "address"]) assert.ok(fields.includes(k), k);
  });

  test(`${id}: library snippets are single sections, paired, and insert into every page`, () => {
    assert.equal(library.ok, true);
    assert.ok(library.library.sections.length >= 10);
    for (const s of library.library.sections) {
      const zh = textOf(s.file);
      const en = textOf(s.en);
      assert.ok(zh, s.file + " exists");
      assert.ok(en, s.en + " exists");
      const sig = (html) => structureSignature(parsePage(editHtml(textOf("index.html"), (doc) => insertSection(doc, -1, html))).doc).split("|")[0];
      assert.equal(sig(zh), sig(en), s.id + " zh/en structure");
      for (const p of pages) {
        const html = editHtml(textOf(p), (doc) => insertSection(doc, 0, p.startsWith("en/") ? en : zh, p));
        assert.notEqual(html, textOf(p), `${s.id} inserts into ${p}`);
        assert.equal(roundTrip(html), html, `${s.id} in ${p} round-trips`);
        assert.deepEqual(missingRefs(html, p), [], `${s.id} in ${p} references`);
      }
    }
  });

  test(`${id}: a new lab's name replaces the placeholder everywhere`, () => {
    const meta = JSON.parse(textOf("labsite/template.json"));
    const placeholder = meta.placeholder?.nameZh;
    assert.ok(placeholder);
    const asBytes = bundle.files.map((f) => ({ path: f.path, bytes: f.text !== undefined ? enc.encode(f.text) : Buffer.from(f.base64, "base64") }));
    const out = personalize(asBytes, { name: "王老師研究室" });
    for (const f of out) {
      if (!/\.(html|js)$/.test(f.path)) continue;
      const text = dec.decode(f.bytes);
      assert.ok(!text.includes(placeholder), f.path + " still has the placeholder");
    }
    const index = dec.decode(out.find((f) => f.path === "index.html").bytes);
    assert.match(index, /<title>王老師研究室<\/title>/);
    assert.match(index, /class="directory__title">王老師研究室</);
  });
}
