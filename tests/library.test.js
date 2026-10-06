// Section library: inserting snippets into real pages, rebasing references for
// en/ pages, turning a section back into a snippet, and the manifest format.
import test from "node:test";
import assert from "node:assert/strict";
import "./dom.js";
const { parsePage, serializePage, editHtml, listSections, sectionElements, insertSection, sectionSnippet, rebaseRefs, structureSignature } =
  await import("../src/site/page.js");
const { parseLibrary, loadLibrary, groupByCategory, snippetPath, LIBRARY_PATH } = await import("../src/site/library.js");

const PAGE = [
  "<!DOCTYPE html>",
  '<html lang="zh-Hant">',
  "<head><title>首頁</title></head>",
  "<body>",
  '  <header class="site-header"></header>',
  "",
  "  <!-- ===== 主視覺 ===== -->",
  '  <section class="hero" id="top">',
  "    <h1>知行研究室</h1>",
  "  </section>",
  "",
  '  <div class="band-divider"></div>',
  "",
  '  <section class="block" id="news">',
  "    <h2>最新消息</h2>",
  "  </section>",
  "",
  '  <script src="js/site.js"></script>',
  "</body>",
  "</html>",
  "",
].join("\n");

const SNIPPET = [
  "<!-- ===== 研究方向 ===== -->",
  '<section class="block" id="research">',
  "  <h2>研究方向</h2>",
  '  <img src="assets/research.svg" alt="研究">',
  '  <a href="research.html">看更多</a>',
  '  <a href="files/plan.pdf">計畫書</a>',
  '  <a href="https://example.org">外部</a>',
  "</section>",
].join("\n");

const titles = (html) => listSections(parsePage(html).doc).map((s) => s.title);

test("insertSection: after a section, keeping the page's divider rhythm and banners", () => {
  const out = editHtml(PAGE, (doc) => insertSection(doc, 0, SNIPPET));
  assert.deepEqual(titles(out), ["知行研究室", "研究方向", "最新消息"]);
  // hero, divider, new, divider, news — every section still separated.
  const body = out.slice(out.indexOf("<body>"), out.indexOf("<script"));
  const order = [...body.matchAll(/<section class="(\w+)"|class="band-divider"|<!-- ===== (\S+)/g)].map((m) => m[1] || m[2] || "divider");
  assert.deepEqual(order, ["主視覺", "hero", "divider", "研究方向", "block", "divider", "block"]);
  // Unchanged parts of the page are untouched.
  assert.ok(out.startsWith(PAGE.slice(0, PAGE.indexOf("<section"))));
  assert.ok(out.endsWith(PAGE.slice(PAGE.indexOf('  <script src="js/site.js">'))));
});

test("insertSection: at the top, at the end, and on a page without dividers", () => {
  const top = editHtml(PAGE, (doc) => insertSection(doc, -1, SNIPPET));
  assert.deepEqual(titles(top), ["研究方向", "知行研究室", "最新消息"]);
  assert.equal((top.match(/band-divider/g) || []).length, 2);
  const end = editHtml(PAGE, (doc) => insertSection(doc, 1, SNIPPET));
  assert.deepEqual(titles(end), ["知行研究室", "最新消息", "研究方向"]);
  assert.equal((end.match(/band-divider/g) || []).length, 2);
  const plain = PAGE.replace(/\n  <div class="band-divider"><\/div>\n/, "");
  const noDiv = editHtml(plain, (doc) => insertSection(doc, 0, SNIPPET));
  assert.equal((noDiv.match(/divider/g) || []).length, 0);
  assert.deepEqual(titles(noDiv), ["知行研究室", "研究方向", "最新消息"]);
});

test("insertSection: refuses bad snippets and indexes; drops ids already on the page", () => {
  for (const bad of ["<div>not a section</div>", "<section></section><section></section>", "", "<p>x</p><section></section>"])
    assert.equal(editHtml(PAGE, (doc) => insertSection(doc, 0, bad)), PAGE, bad);
  assert.equal(editHtml(PAGE, (doc) => insertSection(doc, 5, SNIPPET)), PAGE);
  const clash = SNIPPET.replace('id="research"', 'id="news"');
  const out = editHtml(PAGE, (doc) => insertSection(doc, 0, clash));
  assert.equal((out.match(/id="news"/g) || []).length, 1);
  // A fresh id is kept.
  assert.match(editHtml(PAGE, (doc) => insertSection(doc, 0, SNIPPET)), /id="research"/);
});

test("insertSection into en/ pages rebases assets but not page links", () => {
  const out = editHtml(PAGE, (doc) => insertSection(doc, 0, SNIPPET, "en/index.html"));
  assert.match(out, /src="\.\.\/assets\/research\.svg"/);
  assert.match(out, /href="research\.html"/);
  assert.match(out, /href="\.\.\/files\/plan\.pdf"/);
  assert.match(out, /href="https:\/\/example\.org"/);
  // Round trip of the result is stable.
  assert.equal(serializePage(parsePage(out)), out);
});

test("rebaseRefs leaves absolute, anchor and already-relative references alone", () => {
  const { doc } = parsePage('<!DOCTYPE html><html><head></head><body><section><a href="#x">a</a><a href="/abs.png">b</a><img src="../up.png" srcset="a.png 1x, b.png 2x"><a href="mailto:a@b.tw">m</a><a href="team/">t</a></section></body></html>');
  const s = sectionElements(doc)[0];
  rebaseRefs(s, "en/index.html");
  assert.equal(s.querySelector('a[href="#x"]') !== null, true);
  assert.ok(s.querySelector('a[href="/abs.png"]'));
  assert.equal(s.querySelector("img").getAttribute("src"), "../up.png");
  assert.equal(s.querySelector("img").getAttribute("srcset"), "../a.png 1x, ../b.png 2x");
  assert.ok(s.querySelector('a[href="mailto:a@b.tw"]'));
  assert.ok(s.querySelector('a[href="team/"]'));
});

test("sectionSnippet turns a section back into a reusable snippet", () => {
  const snippet = sectionSnippet(parsePage(PAGE).doc, 0);
  assert.match(snippet, /^<!-- ===== 主視覺 ===== -->\n<section class="hero" id="top">/);
  const enPage = editHtml(PAGE, (doc) => insertSection(doc, 0, SNIPPET, "en/index.html"));
  const back = sectionSnippet(parsePage(enPage).doc, 1, "en/index.html");
  assert.match(back, /src="assets\/research\.svg"/);
  // Re-inserting it gives the same structure as the original snippet.
  const a = editHtml(PAGE, (doc) => insertSection(doc, 0, SNIPPET));
  const b = editHtml(PAGE, (doc) => insertSection(doc, 0, back));
  assert.equal(structureSignature(parsePage(a).doc), structureSignature(parsePage(b).doc));
});

test("library manifest: validated, defaults filled in, bad entries dropped", () => {
  const ok = parseLibrary(
    JSON.stringify({
      version: 1,
      template: "basic",
      sections: [
        { id: "hero-split", name: "主視覺", category: "主視覺", description: "左文右圖" },
        { id: "team", name: "團隊", category: "團隊", en: false },
        { id: "Bad ID", name: "x" },
        { id: "hero-split", name: "重複" },
        { id: "custom", file: "labsite/sections/custom-file.html" },
      ],
    }),
  );
  assert.equal(ok.ok, true);
  assert.equal(ok.library.template, "basic");
  assert.deepEqual(
    ok.library.sections.map((s) => [s.id, s.file, s.en, s.category]),
    [
      ["hero-split", "labsite/sections/hero-split.html", "labsite/sections/hero-split.en.html", "主視覺"],
      ["team", "labsite/sections/team.html", null, "團隊"],
      ["custom", "labsite/sections/custom-file.html", "labsite/sections/custom.en.html", "其他"],
    ],
  );
  assert.equal(parseLibrary("{").ok, false);
  assert.equal(parseLibrary('{"version":2,"sections":[]}').ok, false);
  assert.equal(parseLibrary('{"version":1,"sections":[{"id":"x","file":"../../etc"}]}').library.sections.length, 0);
  assert.equal(snippetPath("a", "en"), "labsite/sections/a.en.html");
  assert.deepEqual(
    groupByCategory(ok.library.sections).map((g) => [g.category, g.items.length]),
    [["主視覺", 1], ["團隊", 1], ["其他", 1]],
  );
});

test("loadLibrary: null without a manifest, error text for a broken one", async () => {
  const files = { [LIBRARY_PATH]: '{"version":1,"sections":[{"id":"a"}]}' };
  const source = { readText: async (p) => (p in files ? files[p] : Promise.reject(new Error("404"))) };
  assert.equal((await loadLibrary(source)).sections.length, 1);
  assert.equal(await loadLibrary({ readText: async () => Promise.reject(new Error("404")) }), null);
  const broken = await loadLibrary({ readText: async () => "nope" });
  assert.equal(broken.sections.length, 0);
  assert.match(broken.error, /JSON/);
});

test("snippetPreviewHtml: the snippet takes the first section's place, header and footer stay around it", async () => {
  const { snippetPreviewHtml } = await import("../src/site/library.js");
  const page = PAGE.replace('  <script src="js/site.js"></script>', '  <footer class="site-footer"></footer>\n  <script src="js/site.js"></script>');
  const out = snippetPreviewHtml(page, SNIPPET, "en/index.html");
  const order = [...out.matchAll(/<(header|section|footer)[\s>]/g)].map((m) => m[1]);
  assert.deepEqual(order, ["header", "section", "footer"]);
  assert.match(out, /src="\.\.\/assets\/research\.svg"/);
  assert.ok(!/band-divider/.test(out));
  // A page without sections: inserted before the footer.
  const empty = '<!DOCTYPE html><html><head></head><body><header></header><footer></footer><script src="a.js"></script></body></html>';
  const filled = snippetPreviewHtml(empty, SNIPPET);
  assert.deepEqual([...filled.matchAll(/<(header|section|footer)[\s>]/g)].map((m) => m[1]), ["header", "section", "footer"]);
});
