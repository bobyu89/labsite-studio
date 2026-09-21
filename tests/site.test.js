import test from "node:test";
import assert from "node:assert/strict";
import "./dom.js";
const {
  parsePage,
  serializePage,
  roundTrip,
  listSections,
  sectionElements,
  moveSection,
  removeSection,
  duplicateSection,
  collectFields,
  setText,
  setAttribute,
  readHead,
  writeHead,
  editHtml,
} = await import("../src/site/page.js");
const { readSiteFields, patchSiteField } = await import("../src/site/siteData.js");
const { normalizePath, resolveFrom, isPagePath, sequentialWriter, stagedSource } = await import("../src/site/source.js");
const { deepEqual } = await import("../src/domain/equal.js");
const { createHistory, historyReducer } = await import("../src/domain/history.js");

const FIXTURE = [
  "<!DOCTYPE html>",
  '<html lang="zh-Hant">',
  "<head>",
  '  <meta charset="UTF-8">',
  "  <title>團隊成員｜研究室</title>",
  '  <meta name="description" content="認識成員。">',
  '  <meta property="og:title" content="團隊成員｜研究室">',
  '  <meta property="og:description" content="認識成員。">',
  '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
  '  <link rel="stylesheet" href="css/main.css">',
  "</head>",
  "<body>",
  '  <div class="news-ticker" id="news-ticker"></div>',
  '  <section class="section page-hero" id="top">',
  '    <h1 class="page-hero__title">團隊成員</h1>',
  '    <p class="page-hero__desc">認識研究室的 <span class="hl">研究團隊</span> 成員。</p>',
  '    <svg viewBox="0 0 64 64"><rect x="1" y="2"/><path d="M1 2"/></svg>',
  "  </section>",
  "",
  '  <div class="ecg-divider"></div>',
  "",
  "  <!-- ===== 研究團隊 ===== -->",
  '  <section class="section" id="team">',
  "    <h2>研究團隊</h2>",
  '    <img class="avatar" src="assets/members/pi.jpg" alt="老師照片">',
  '    <a class="btn" href="pi.html">主持人簡介 →</a>',
  '    <p class="form-error" hidden>請填寫</p>',
  "  </section>",
  "",
  '  <div class="ecg-divider"></div>',
  "",
  '  <section class="section" id="contact">',
  "    <h2>聯絡我們</h2>",
  '    <ul><li>國防醫學大學</li><li>護理學系</li></ul>',
  "  </section>",
  '  <script src="js/data.js"></script>',
  "  <script>initLayout('members');</script>",
  "</body>",
  "</html>",
  "",
].join("\r\n");

test("round trip preserves CRLF, doctype, void svg leaves and valueless attributes", () => {
  assert.equal(roundTrip(FIXTURE), FIXTURE);
  const lf = FIXTURE.replace(/\r\n/g, "\n");
  assert.equal(roundTrip(lf), lf);
});

test("round trip keeps explicit-closed svg leaves, raw non-breaking spaces and & in attributes", () => {
  // Sites we did not write (Jekyll templates and the like) do all three.
  const page = [
    "<!DOCTYPE html>",
    "<html><head>",
    '<link href="https://fonts.example/css?family=A&amp;family=B" rel="stylesheet">',
    "</head><body>",
    "<section>",
    '<svg><circle cx="0" r="3"></circle><path d="M1 2"/><rect x="1" /></svg>',
    "<p>© 2026 | Built with <a href=\"?a=1&amp;b=2\">Tom &amp; Jerry</a></p>",
    "</section>",
    "</body></html>",
    "",
  ].join("\n");
  assert.equal(roundTrip(page), page);
  // And an edit inside that section still only changes what was edited.
  const edited = editHtml(page, (doc) => {
    doc.querySelector("a").textContent = "Tom";
  });
  assert.equal(edited, page.replace("Tom &amp; Jerry", "Tom"));
});

test("sections are listed with headings and kinds", () => {
  const { doc } = parsePage(FIXTURE);
  const s = listSections(doc);
  assert.deepEqual(
    s.map((x) => [x.title, x.kind, x.id]),
    [
      ["團隊成員", "主視覺", "top"],
      ["研究團隊", "內容", "team"],
      ["聯絡我們", "內容", "contact"],
    ],
  );
});

test("moving a section keeps the divider rhythm and everything else in place", () => {
  const out = editHtml(FIXTURE, (doc) => moveSection(doc, 2, 0));
  const { doc } = parsePage(out);
  assert.deepEqual(
    listSections(doc).map((x) => x.id),
    ["contact", "top", "team"],
  );
  const kinds = [...doc.body.children].map((el) => el.tagName.toLowerCase() + (el.className ? "." + el.className.split(" ")[0] : ""));
  assert.deepEqual(kinds, [
    "div.news-ticker",
    "section.section",
    "div.ecg-divider",
    "section.section",
    "div.ecg-divider",
    "section.section",
    "script",
    "script",
  ]);
  assert.ok(out.includes("initLayout('members')"));
  assert.equal(editHtml(FIXTURE, (doc) => moveSection(doc, 1, 1)), FIXTURE);
  // The comment banner travels with its section.
  const moved = editHtml(FIXTURE, (doc) => moveSection(doc, 1, 0));
  assert.ok(
    moved.includes(
      '<!-- ===== 研究團隊 ===== -->\r\n  <section class="section" id="team">',
    ),
  );
  assert.equal(moved.match(/研究團隊 =====/g).length, 1);
});

test("removing a section also removes its adjacent divider; last section cannot be removed", () => {
  const out = editHtml(FIXTURE, (doc) => removeSection(doc, 1));
  const { doc } = parsePage(out);
  assert.deepEqual(listSections(doc).map((x) => x.id), ["top", "contact"]);
  assert.equal(doc.querySelectorAll(".ecg-divider").length, 1);
  assert.ok(!out.includes("研究團隊 ====="));
  const one = editHtml(FIXTURE, (doc) => {
    removeSection(doc, 0);
    removeSection(doc, 0);
    return true;
  });
  assert.equal(editHtml(one, (doc) => removeSection(doc, 0)), one);
});

test("duplicating a section strips ids and inserts a divider", () => {
  const out = editHtml(FIXTURE, (doc) => duplicateSection(doc, 1));
  const { doc } = parsePage(out);
  const s = listSections(doc);
  assert.equal(s.length, 4);
  assert.equal(s[2].title, "研究團隊");
  assert.equal(s[2].id, "");
  assert.equal(doc.querySelectorAll("#team").length, 1);
  assert.equal(doc.querySelectorAll(".ecg-divider").length, 3);
  assert.equal(out.match(/研究團隊 =====/g).length, 2);
});

test("fields cover text nodes, inline spans, links and images with stable paths", () => {
  const { doc } = parsePage(FIXTURE);
  const hero = sectionElements(doc)[0];
  const fields = collectFields(hero);
  assert.deepEqual(
    fields.map((f) => [f.kind, f.label, f.value ?? f.href ?? f.src]),
    [
      ["text", "標題", "團隊成員"],
      ["text", "說明", "認識研究室的"],
      ["text", "說明 › 文字", "研究團隊"],
      ["text", "說明", "成員。"],
    ],
  );
  const team = collectFields(sectionElements(doc)[1]);
  assert.deepEqual(
    team.map((f) => f.kind),
    ["text", "image", "link", "text", "text"],
  );
  assert.equal(team[1].src, "assets/members/pi.jpg");
  assert.equal(team[2].href, "pi.html");
});

test("setText keeps surrounding whitespace and setAttribute only touches safe attributes", () => {
  const out = editHtml(FIXTURE, (doc) => {
    const hero = sectionElements(doc)[0];
    const f = collectFields(hero);
    setText(hero, f[0].path, "我們的團隊");
    const team = sectionElements(doc)[1];
    const t = collectFields(team);
    setAttribute(team, t[1].path, "alt", "新照片");
    assert.equal(setAttribute(team, t[1].path, "onerror", "alert(1)"), false);
    return true;
  });
  assert.ok(out.includes('<h1 class="page-hero__title">我們的團隊</h1>'));
  assert.ok(out.includes('alt="新照片"'));
  assert.ok(!out.includes("onerror"));
  const lines = out.split("\r\n");
  assert.equal(lines.length, FIXTURE.split("\r\n").length);
});

test("head title and description sync their social tags", () => {
  const out = editHtml(FIXTURE, (doc) => {
    writeHead(doc, { title: "成員｜新名稱", description: "新描述" });
    return true;
  });
  const { doc } = parsePage(out);
  assert.deepEqual(readHead(doc), { title: "成員｜新名稱", description: "新描述" });
  assert.equal(doc.querySelector('meta[property="og:title"]').getAttribute("content"), "成員｜新名稱");
  assert.equal(doc.querySelector('meta[property="og:description"]').getAttribute("content"), "新描述");
});

const DATA = [
  "/* header */",
  "const SITE = {",
  '  nameZh: "護理創新研究室",',
  '  nameEn: "Nursing Lab",',
  '  tagline: "結合 \\"實證\\" 與創新",',
  '  email: "a@b.c", // 聯絡',
  "  stats: { publications: 23, projects: 12 }",
  "};",
  'const CONFIG = { SHEET_ID: "abc" };',
].join("\n");

test("SITE string fields are read and patched in place without touching the rest", () => {
  const r = readSiteFields(DATA);
  assert.ok(r.ok);
  assert.deepEqual(
    r.fields.map((f) => [f.key, f.value]),
    [
      ["nameZh", "護理創新研究室"],
      ["nameEn", "Nursing Lab"],
      ["tagline", '結合 "實證" 與創新'],
      ["email", "a@b.c"],
    ],
  );
  const out = patchSiteField(DATA, "tagline", 'A "B"\nC');
  assert.ok(out.includes('tagline: "A \\"B\\"\\nC",'));
  assert.ok(out.includes('email: "a@b.c", // 聯絡'));
  assert.ok(out.includes('SHEET_ID: "abc"'));
  assert.equal(readSiteFields(out).fields[2].value, 'A "B"\nC');
  assert.throws(() => patchSiteField(DATA, "SHEET_ID", "x"));
  assert.equal(readSiteFields("nothing here").ok, false);
});

test("sequentialWriter writes each file in order; stagedSource overlays unsaved files for previews", async () => {
  const log = [];
  const write = sequentialWriter(
    async (p, t) => log.push(["text", p, t]),
    async (p, b) => log.push(["blob", p, await b.text()]),
  );
  assert.equal(await write([{ path: "a.html", text: "A" }, { path: "assets/x.png", blob: new Blob(["PNG"]) }]), null);
  assert.deepEqual(log, [["text", "a.html", "A"], ["blob", "assets/x.png", "PNG"]]);

  const real = {
    kind: "x",
    readText: async (p) => "real:" + p,
    readBlob: async (p) => new Blob(["real:" + p]),
    writeText: async () => "written",
  };
  assert.equal(stagedSource(real, {}), real, "nothing staged: same object, no rebuilds");
  const s = stagedSource(real, { "assets/new.png": new Blob(["staged"]), "css/main.css": "body{}" });
  assert.equal(await (await s.readBlob("./assets/new.png")).text(), "staged");
  assert.equal(await s.readText("css/main.css"), "body{}");
  assert.equal(await (await s.readBlob("css/main.css")).text(), "body{}");
  assert.equal(await s.readText("index.html"), "real:index.html");
  assert.equal(await (await s.readBlob("assets/old.png")).text(), "real:assets/old.png");
  assert.equal(await s.writeText("x", "y"), "written", "writes pass through untouched");
  assert.equal(s.kind, "x");
});

test("paths stay inside the site and resolve relative to the page", () => {
  assert.equal(normalizePath("./en/../css/main.css"), "css/main.css");
  assert.throws(() => normalizePath("../secret"));
  assert.equal(resolveFrom("en/index.html", "../css/main.css"), "css/main.css");
  assert.equal(resolveFrom("index.html", "assets/a%20b.png"), "assets/a b.png");
  assert.equal(resolveFrom("index.html", "https://x.y/z.css"), null);
  assert.equal(resolveFrom("index.html", "#contact"), null);
  assert.equal(resolveFrom("en/index.html", "research.html#top"), "en/research.html");
  assert.ok(isPagePath("en/pi.html"));
  assert.ok(!isPagePath("js/data.js"));
});

test("deepEqual compares structure and short-circuits on shared references", () => {
  const big = "x".repeat(1_000_000);
  const a = { assets: [{ src: big }], n: [1, 2, { k: null }] };
  const b = { assets: [{ src: big }], n: [1, 2, { k: null }] };
  assert.ok(deepEqual(a, b));
  assert.ok(!deepEqual(a, { ...b, n: [1, 2, { k: 0 }] }));
  assert.ok(!deepEqual([1], { 0: 1 }));
  assert.ok(!deepEqual({ a: undefined }, {}));
});

test("history works on HTML strings and ignores no-op edits", () => {
  let h = createHistory(FIXTURE);
  h = historyReducer(h, { type: "change", update: (s) => editHtml(s, (doc) => moveSection(doc, 0, 0)), at: 1 });
  assert.equal(h.past.length, 0);
  h = historyReducer(h, { type: "change", update: (s) => editHtml(s, (doc) => moveSection(doc, 0, 1)), at: 2 });
  assert.equal(h.past.length, 1);
  assert.notEqual(h.present, FIXTURE);
  h = historyReducer(h, { type: "undo" });
  assert.equal(h.present, FIXTURE);
});
